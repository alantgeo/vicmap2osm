#!/usr/bin/env node

/**
 * Conflate processed Vicmap addresses with existing addresses in OSM
 */

const fs = require('fs')
const { Transform, pipeline } = require('stream')
const ndjson = require('ndjson')
const PolygonLookup = require('polygon-lookup')
const Flatbush = require('flatbush')
const bbox = require('@turf/bbox').default
const multiLineString = require('@turf/helpers').multiLineString
const centroid = require('@turf/centroid').default
const booleanIntersects = require('@turf/boolean-intersects').default

const argv = require('yargs/yargs')(process.argv.slice(2))
  .option('debug', {
    type: 'boolean',
    description: 'Include debugging attributes on outputs'
  })
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

    if (process.stdout.isTTY && sourceCount % 1000 === 0) {
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
        if (!('id' in block)) {
          console.error('Expected id for block, maybe you are missing the polygon-lookup patch, try cp src/polygon-lookup-patch.js node_modules/polygon-lookup/index.js')
          process.exit(1)
        }

        // see if any address with the same number and street in the same block
        if (block.id in osmAddrPoints || block.id in osmAddrPolygonsByBlock) {
          // for loop with push is faster than spread then flat, or concat
          const osmAddrWithinBlock = []
          if (block.id in osmAddrPoints) {
            for (let i = 0; i < osmAddrPoints[block.id].length; i++) {
              osmAddrWithinBlock.push(osmAddrPoints[block.id][i])
            }
          }
          if (block.id in osmAddrPolygonsByBlock) {
            for (let i = 0; i < osmAddrPolygonsByBlock[block.id].length; i++) {
              osmAddrWithinBlock.push(osmAddrPolygonsByBlock[block.id][i])
            }
          }

          const matches = osmAddrWithinBlock.filter(osmAddr => {
            const osmStreet = osmAddr.properties['addr:street']

            // where someone has used unit/number style values for addr:housenumber, only compare the number component
            const osmHouseNumber = 'addr:housenumber' in osmAddr.properties ? (osmAddr.properties['addr:housenumber'].split('/').length > 1 ? osmAddr.properties['addr:housenumber'].split('/')[1] : osmAddr.properties['addr:housenumber']) : null

            const osmUnit = 'addr:unit' in osmAddr.properties
              ? osmAddr.properties['addr:unit'].toLowerCase().replaceAll(' ', '')
              : (
                'addr:housenumber' in osmAddr.properties && osmAddr.properties['addr:housenumber'].split('/').length > 1
                ? osmAddr.properties['addr:housenumber'].split('/')[0].toLowerCase().replaceAll(' ', '')
                : null
              )

            const vicmapUnit = 'addr:unit' in feature.properties ? feature.properties['addr:unit'].toLowerCase().replaceAll(' ', '') : null

            // see if unit, number, street matches
            // ignoring whitespace when comparing house numbers
            // ignoring case
            // ignoring differences between "Foo - Bar Street" and "Foo-Bar Street", these kinds of names are common in country victoria
            const isMatched = feature.properties['addr:street'] && osmStreet
              && feature.properties['addr:street'].toLowerCase().replaceAll(' - ', '-').replaceAll('-', '') === osmStreet.toLowerCase().replaceAll(' - ', '-').replaceAll('-', '')
              && osmHouseNumber !== null && feature.properties['addr:housenumber'].replaceAll(' ', '').toLowerCase() === osmHouseNumber.replaceAll(' ', '').toLowerCase()
              && (vicmapUnit === osmUnit)

            // if matched but the match came from exploding X/Y into Unit X, Number Y, then automate this to be changed in OSM
            if (isMatched && osmAddr.properties['addr:housenumber'].split('/').length > 1) {
              // MapRoulette task
              const task = {
                type: 'FeatureCollection',
                features: [ osmAddr ],
                cooperativeWork: {
                  meta: {
                    version: 2,
                    type: 1 // tag fix type
                  },
                  operations: [{
                    operationType: 'modifyElement',
                    data: {
                      id: `${osmAddr.properties['@type']}/${osmAddr.properties['@id']}`,
                      operations: [{
                        operation: 'setTags',
                        data: {
                          'addr:unit': osmUnit,
                          'addr:housenumber': osmHouseNumber
                        }
                      }]
                    }
                  }]
                }
              }
              outputStreams.mr_explodeUnitFromNumber.write(task)
            }

            return isMatched
          })

          if (matches.length) {
            // matching unit/number/street => high confidence
            if (argv.debug) {
              feature.properties._matches = matches.map(match => `${match.properties['@type']}/${match.properties['@id']}`).join(',')
            }
            outputStreams.exactMatch.write(feature)

            const exactMatchLine = multiLineString(matches.map(match => [feature.geometry.coordinates, centroid(match).geometry.coordinates]), feature.properties)
            outputStreams.exactMatchLines.write(exactMatchLine)
          } else {
            // no exact match see if containing within an existing OSM address polygon
            const results = lookupOSMAddressPoly.search(...feature.geometry.coordinates.slice(0, 2), 1)
            const osmPoly = results ? (results.type === 'FeatureCollection' ? (results.features ? results.features[0] : null) : results) : null
            if (osmPoly) {
              // address found within an existing OSM address polygon
              if (argv.debug) {
                feature.properties._osm = `${osmPoly.properties['@type']}/${osmPoly.properties['@id']}`
              }

              outputStreams.withinExistingOSMAddressPoly.write(feature)

              // MapRoulette task
              const task = {
                type: 'FeatureCollection',
                features: [ feature, osmPoly ],
                cooperativeWork: {
                  meta: {
                    version: 2,
                    type: 1 // tag fix type
                  },
                  operations: [{
                    operationType: 'modifyElement',
                    data: {
                      id: `${osmPoly.properties['@type']}/${osmPoly.properties['@id']}`,
                      operations: [{
                        operation: 'setTags',
                        data: feature.properties
                      }]
                    }
                  }]
                }
              }
              outputStreams.mr_withinExistingOSMAddressPoly.write(task)
            } else {
              // address not found within an existing OSM address polygon
              outputStreams.noExactMatch.write(feature)
            }
          }
        } else {
          // block id not found in osmAddrPoints or osmAddrPolygonsByBlock,
          // however the block was found to be containing OSM addresses
          // this likely happens when there is an address on a linear way like address interpolation line
          // given this import plans to replace address interpolation lines, then output as fine to import
          outputStreams.noOSMAddressWithinBlock.write(feature)
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
const outputKeys = ['notFoundInBlocks', 'noExactMatch', 'exactMatch', 'exactMatchLines', 'mr_explodeUnitFromNumber', 'mr_withinExistingOSMAddressPoly', 'withinExistingOSMAddressPoly', 'noOSMAddressWithinBlock']
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

        if (process.stdout.isTTY && osmAddrPolygonIndex % 100 === 0) {
          process.stdout.write(` ${osmAddrPolygonIndex.toLocaleString()} of ${osmAddrPolygons.length.toLocaleString()} (${Math.round(osmAddrPolygonIndex / osmAddrPolygons.length * 100)}%)\r`)
        }

        // find the blocks it might intersect
        const candidateBlocks = blockIndex.search(...bbox(osmAddrPolygon))

        // then test if it actually intersects
        const intersectingBlocks = candidateBlocks.filter(candidateBlock => booleanIntersects(osmAddrPolygon, blocksByOSMAddr[candidateBlock]))
        for (const intersectingBlock of intersectingBlocks) {
          if (!((intersectingBlock + 1) in osmAddrPolygonsByBlock)) {
            osmAddrPolygonsByBlock[intersectingBlock + 1] = []
          }
          osmAddrPolygonsByBlock[intersectingBlock + 1].push(osmAddrPolygon)
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
