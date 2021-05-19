#!/usr/bin/env node

/**
 * Prepare import candidates by conflating with existing addresses in OSM
 */

const fs = require('fs')
const { Transform, pipeline } = require('stream')
const ndjson = require('ndjson')
const PolygonLookup = require('polygon-lookup')
const Flatbush = require('flatbush')
const bbox = require('@turf/bbox').default
const booleanIntersects = require('@turf/boolean-intersects').default

const argv = require('yargs/yargs')(process.argv.slice(2))
  .option('verbose', {
    type: 'boolean',
    description: 'Verbose logging'
  })
  .argv

if (argv._.length < 4) {
  console.error("Usage: ./conflate.js vicmap.geojson osm.geojson blocksByOSMAddr.geojson dist/conflate")
  process.exit(1)
}

const vicmapFile = argv._[0]
const osmFile = argv._[1]
const blocksByOSMAddrFile = argv._[2]
const outputPath = argv._[3]

if (!fs.existsSync(vicmapFile)) {
  console.error(`${vicmapFile} not found`)
  process.exit(1)
}
if (!fs.existsSync(osmFile)) {
  console.error(`${osmFile} not found`)
  process.exit(1)
}
if (!fs.existsSync(blocksByOSMAddrFile)) {
  console.error(`${blocksByOSMAddrFile} not found`)
  process.exit(1)
}

const blocksByOSMAddr = fs.readFileSync(blocksByOSMAddrFile, 'utf-8').toString().split('\n')
  .filter(line => line !== '')
  .map((line, index) => {
    try {
      const feature = JSON.parse(line)
      feature.id = index + 1
      return feature
    } catch {
      console.log(`Error parsing line ${index} of ${blocksByOSMAddrFile}: ${line}`)
    }
  })

console.log('Creating index for Blocks by OSM Address lookup')
const lookupBlocks = new PolygonLookup({
  type: 'FeatureCollection',
  features: blocksByOSMAddr
})
let lookupOSMAddressPoly
const osmAddrPolygons = []
const osmAddrLines = [] // address interpolation lines

// indexed by block
const osmAddrPoints = {
  0: [] // this one is for any points not within a block
}
const osmAddrPolygonsByBlock = {
  0: [] // this one is for any polygons not within a block
}


// find OSM Addresses and store them
// polygons go into a simple array, which later we create a point in polygon index for
// points and lines a simple object index by block id
let osmAddrCount = 0
const filterOSMAddrPoly = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    osmAddrCount++

    if (process.stdout.isTTY && osmAddrCount % 10000 === 0) {
      process.stdout.write(` ${osmAddrCount.toLocaleString()}\r`)
    }

    if (feature && feature.geometry && feature.geometry.type) {
      if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        osmAddrPolygons.push(feature)
      } else if (feature.geometry.type === 'Point') {
        const results = lookupBlocks.search(...feature.geometry.coordinates.slice(0, 2), 1)
        const block = results ? (results.type === 'FeatureCollection' ? (results.features ? results.features[0] : null) : results) : null
        if (block) {
          if (!(block.id in osmAddrPoints)) {
            osmAddrPoints[block.id] = []
          }
          osmAddrPoints[block.id].push(feature)
        } else {
          // not found within a block
          osmAddrPoints[0].push(feature)
        }
      } else if (feature.geometry.type === 'LineString') {
        // TODO also index by block, but could be a few blocks
        osmAddrLines.push(feature)
      } else {
        console.log(`Unsupported geometry type ${feature.geometry.type} for ${feature.properties['@type']}/${feature.properties['@id']}`)
      }
    }

    callback()
  }
})

// conflate vicmap addresses with OSM addresses
let sourceCount = 0
const conflate = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    sourceCount++

    if (process.stdout.isTTY && sourceCount % 10000 === 0) {
      process.stdout.write(` ${sourceCount.toLocaleString()}\r`)
    }

    // find which block this vicmap address is in
    const results = lookupBlocks.search(...feature.geometry.coordinates.slice(0, 2), 1)
    const block = results ? (results.type === 'FeatureCollection' ? (results.features ? results.features[0] : null) : results) : null
    if (block) {
      // address within a block
      if (block.properties.NUMPOINTS === 0) {
        // no OSM addresses found within this block, so able to import without review
        outputStreams.noOSMAddressWithinBlock.write(feature)
      } else {
        // other OSM addresses found within this block, so need to conflate
        const results = lookupOSMAddressPoly.search(...feature.geometry.coordinates.slice(0, 2), 1)
        const osmPoly = results ? (results.type === 'FeatureCollection' ? (results.features ? results.features[0] : null) : results) : null
        if (osmPoly) {
          // address found within an existing OSM address polygon
          feature.properties._osmtype = osmPoly.properties['@type']
          feature.properties._osmid = osmPoly.properties['@id']
          outputStreams.withinExistingOSMAddressPoly.write(feature)
        } else {
          // address not found within an existing OSM address polygon
          
          // see if any address with the same number and street in the same block
          if (block.id in osmAddrPoints || block.id in osmAddrPolygonsByBlock) {
            const osmAddrWithinBlock = [osmAddrPoints[block.id] || [], osmAddrPolygonsByBlock[block.id] || []].flat()
            const matches = osmAddrWithinBlock.filter(osmAddr => {
              const osmStreet = osmAddr.properties['addr:street']

              // where someone has used unit/number style values for addr:housenumber, only compare the number component
              const osmHouseNumber = 'addr:housenumber' in osmAddr.properties ? (osmAddr.properties['addr:housenumber'].split('/').length > 1 ? osmAddr.properties['addr:housenumber'].split('/')[1] : osmAddr.properties['addr:housenumber']) : null

              const osmUnit = 'addr:unit' in osmAddr.properties
                ? osmAddr.properties['addr:unit']
                : (
                  'addr:housenumber' in osmAddr.properties && osmAddr.properties['addr:housenumber'].split('/').length > 1
                  ? osmAddr.properties['addr:housenumber'].split('/')[0]
                  : null
                )

              return feature.properties['addr:street'] === osmStreet
                && osmHouseNumber !== null && feature.properties['addr:housenumber'] === osmHouseNumber
                && (('addr:unit' in feature.properties && osmUnit !== null) ? feature.properties['addr:unit'] === osmUnit : true)
            })
            if (matches.length) {
              // matching number and street, high confidence
              feature.properties._matches = matches.map(match => `${match.properties['@type']}/${match.properties['@id']}`).join(',')
              outputStreams.exactMatch.write(feature)
            } else {
              // no exact match, probably can import
              outputStreams.noExactMatch.write(feature)
            }
          } else {
            // block id not found in osmAddrPoints or osmAddrPolygonsByBlock, meaning there are no osmAddress points or polygons in this block,
            // maybe there was an address as a linear way?
            // we ignore address interpolation lines and only look at the endpoint nodes from the interpolation way
            console.log(`Block ID ${block.id} not found when expected for `, JSON.stringify(feature), JSON.stringify(block))
          }
        }
      }
    } else {
      // address not found within blocksByOSMAddr, probably within coastal zone, manually review
      outputStreams.notFoundInBlocks.write(feature)
    }

    callback()
  }
})

// ndjson streams to output features
const outputKeys = ['notFoundInBlocks', 'noExactMatch', 'exactMatch', 'withinExistingOSMAddressPoly', 'noOSMAddressWithinBlock']
const outputStreams = {}
const outputStreamOutputs = {}

outputKeys.forEach(key => {
  outputStreams[key] = ndjson.stringify()
  outputStreamOutputs[key] = outputStreams[key].pipe(fs.createWriteStream(`${outputPath}/${key}.geojson`))
})

// first pass to index by geometry
console.log('Pass 1/2: Find OSM addresses represented as areas and store them in memory')
pipeline(
  fs.createReadStream(osmFile),
  ndjson.parse(),
  filterOSMAddrPoly,
  err => {
    if (err) {
      console.log(err)
      process.exit(1)
    } else {
      console.log(`  of ${osmAddrCount} OSM address features found ${osmAddrPolygons.length} addresses represented as polygons, ${osmAddrLines.length} addresses represented as lines`)

      console.log('Creating index for OSM Address Polygon lookup')
      lookupOSMAddressPoly = new PolygonLookup({
        type: 'FeatureCollection',
        features: osmAddrPolygons
      })

      // create an index of blocks
      const blockIndex = new Flatbush(blocksByOSMAddr.length)
      for (const block of blocksByOSMAddr) {
        blockIndex.add(...bbox(block))
      }
      blockIndex.finish()

      console.log(`Index OSM Address Polygons within each block`)
      // for each OSM address polygon
      let osmAddrPolygonIndex = 0
      for (const osmAddrPolygon of osmAddrPolygons) {
        osmAddrPolygonIndex++

        if (process.stdout.isTTY && osmAddrPolygonIndex % 1000 === 0) {
          process.stdout.write(` ${osmAddrPolygonIndex.toLocaleString()}\r`)
        }

        // find the blocks it might intersect
        const candidateBlocks = blockIndex.search(...bbox(osmAddrPolygon))
        // then test if it actually intersects
        const intersectingBlocks = candidateBlocks.map(candidateBlock => booleanIntersects(osmAddrPolygon, blocksByOSMAddr[candidateBlock]))
        for (const intersectingBlock of intersectingBlocks) {
          if (!(intersectingBlock.id in osmAddrPolygonsByBlock)) {
            osmAddrPolygonsByBlock[intersectingBlock.id] = []
          }
          osmAddrPolygonsByBlock[intersectingBlock.id].push(osmAddrPolygon)
        }
      }

      // second pass to conflate with existing OSM data
      console.log('Pass 2/2: Conflate with existing OSM data')
      pipeline(
        fs.createReadStream(vicmapFile),
        ndjson.parse(),
        conflate,
        err => {
          if (err) {
            console.log(err)
            process.exit(1)
          } else {
            outputKeys.forEach(key => {
              outputStreams[key].end()
            })

            Promise.all(outputKeys.map(key => {
              return new Promise(resolve => {
                outputStreamOutputs[key].on('finish', () => {
                  console.log(`saved ${outputPath}/${key}.geojson`)
                  resolve()
                })
              })
            }))
              .then(() => {
                process.exit(0)
              })
          }
        }
      )
    }
  }
)
