#!/usr/bin/env node

/**
 * Prepare import candidates by conflating with existing addresses in OSM
 */

const fs = require('fs')
const { Transform, pipeline } = require('stream')
const ndjson = require('ndjson')
const PolygonLookup = require('polygon-lookup')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .option('debug', {
    type: 'boolean',
    description: 'Dumps full debug logs'
  })
  .argv

if (argv._.length < 4) {
  console.error("Usage: ./conflate.js vicmap.geojson osm.geojson blocksByOSMAddr.geojson output.geojson")
  process.exit(1)
}

const vicmapFile = argv._[0]
const osmFile = argv._[1]
const blocksByOSMAddrFile = argv._[2]
const outputFile = argv._[3]

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
      // console.log(feature)
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
const osmAddrPoly = []
const osmAddrLines = [] // address interpolation lines
// indexed by block
const osmAddrPoints = {
  0: [] // this one is for any points not within a block
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

    console.log(feature)
    if (process.stdout.isTTY && osmAddrCount % 10000 === 0) {
      process.stdout.write(` ${osmAddrCount / 1000}k\r`)
    }

    if (feature && feature.geometry && feature.geometry.type) {
      if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        osmAddrPoly.push(feature)
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

    // pass through for further processing
    this.push(feature)

    callback()
  }
})

// conflate vicmap addresses with OSM addresses
const conflate = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    sourceCount++

    if (process.stdout.isTTY && sourceCount % 10000 === 0) {
      process.stdout.write(` ${sourceCount / 1000}k\r`)
    }

    const results = lookupBlocks.search(...feature.geometry.coordinates.slice(0, 2), 1)
    const block = results ? (results.type === 'FeatureCollection' ? (results.features ? results.features[0] : null) : results) : null
    if (block) {
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
          if (block.id in osmAddrPoints) {
            const osmAddrWithinBlock = osmAddrPoints[block.id]
            const matches = osmAddrWithinBlock.filter(osmAddr => {
              return (feature.properties['addr:street'] === osmAddr.properties['addr:street'] &&
              feature.properties['addr:housenumber'] === osmAddr.properties['addr:housenumber'] )
            })
            if (matches.length) {
              // matching number and street, high confidence
              outputStreams.exactMatch.write(feature)
            } else {
              // no exact match, probably can import
              outputStreams.noExactMatch.write(feature)
            }
          } else {
            // block id not found in osmAddrPoints, meaning there are no osmAddress points in this block,
            // however in this case NUMPOINTS should have been 0
            console.log(`Block ID not found when expected`)
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

// ndjson streams to output debug features
const outputKeys = ['notFoundInBlocks', 'noExactMatch', 'exactMatch', 'withinExistingOSMAddressPoly']
const outputStreams = {}
const outputStreamOutputs = {}

outputKeys.forEach(key => {
  outputStreams[key] = ndjson.stringify()
  outputStreamOutputs[key] = outputStreams[key].pipe(fs.createWriteStream(`debug/conflate/${key}.geojson`))
})

// first pass to index by geometry
console.log('First find OSM addresses represented as areas and store them in memory')
pipeline(
  fs.createReadStream(osmFile),
  ndjson.parse(),
  filterOSMAddrPoly,
  err => {
    if (err) {
      console.log(err)
      process.exit(1)
    } else {
      console.log(`  of ${osmAddrCount} OSM address features found ${osmAddrPoly.length} addresses represented as polygons, ${osmAddrLines.length} addresses represented as lines`)
      console.log('Creating index for OSM Address Polygon lookup')
      lookupOSMAddressPoly = new PolygonLookup({
        type: 'FeatureCollection',
        features: osmAddrPoly
      })
      // second pass to conflate with existing OSM data
      pipeline(
        fs.createReadStream(vicmapFile),
        ndjson.parse(),
        conflate,
        //ndjson.stringify(),
        //fs.createWriteStream(outputFile),
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
                  console.log(`saved debug/conflate/${key}.geojson`)
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
