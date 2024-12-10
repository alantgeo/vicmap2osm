#!/usr/bin/env node

/**
 * Prepare import candidates by conflation category and suburb as OSM XML
 */

const fs = require('fs')
const path = require('path')
const { Transform, pipeline } = require('stream')
const ndjson = require('ndjson')
const PolygonLookup = require('polygon-lookup')
const geojsontoosm = require('geojsontoosm')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .option('verbose', {
    type: 'boolean',
    description: 'Verbose logging'
  })
  .argv

if (argv._.length < 3) {
  console.error("Usage: ./conflate.js data/victoria-admin-level10.osm.geojson dist/conflate dist/candidates")
  process.exit(1)
}

const suburbsFile = argv._[0]
const conflatePath = argv._[1]
const outputPath = argv._[2]

if (!fs.existsSync(suburbsFile)) {
  console.error(`${suburbsFile} not found`)
  process.exit(1)
}

if (!fs.existsSync(conflatePath)) {
  console.error(`${conflatePath} not found`)
  process.exit(1)
}

// output GeoJSON Features by layer by suburb ID
const outputFeatures = {
  'newAddressesInBlocksWithoutAnyExisting': {}
}

for (const layer of Object.keys(outputFeatures)) {
  const layerPath = path.join(outputPath, layer)
  if (!fs.existsSync(layerPath)) {
    fs.mkdirSync(layerPath)
  }
}

// suburb GeoJSON Features
const suburbs = []

// suburb ID to name
const suburbName = {
  0: 'VIC'
}

// suburb point in polygon index
let lookupSuburbs

const outsideVicSuburb = {
  type: 'Feature',
  id: 0,
  properties: {
    name: 'VIC'
  },
  geometry: null
}

// index suburbs
let suburbCount = 0
const readSuburbs = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(suburb, encoding, callback) {
    suburbCount++

    if (process.stdout.isTTY && suburbCount % 1000 === 0) {
      process.stdout.write(` ${suburbCount.toLocaleString()}\r`)
    }

    if (!('id' in suburb)) {
      console.log('Suburb missing id', suburb)
      process.exit(1)
    }

    for (const layer of Object.keys(outputFeatures)) {
      outputFeatures[layer][suburb.id] = []
    }

    suburbName[suburb.id] = suburb.properties.name

    suburbs.push(suburb)

    callback()
  }
})

function findSuburb(feature) {
  // find which suburb this address is in
  const results = lookupSuburbs.search(...feature.geometry.coordinates.slice(0, 2), 1)
  const suburb = results ? (results.type === 'FeatureCollection' ? (results.features ? results.features[0] : outsideVicSuburb) : results[0]) : outsideVicSuburb

  return suburb
}


// produce import candidates
let sourceCount = 0
const candidatesNewAddressesInBlocksWithoutAnyExisting = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, _encoding, callback) {
    sourceCount++

    if (process.stdout.isTTY && sourceCount % 1000 === 0) {
      process.stdout.write(` ${sourceCount.toLocaleString()}\r`)
    }

    // remove tracing properties
    delete feature.properties._pfi

    const suburb = findSuburb(feature)

    outputFeatures['newAddressesInBlocksWithoutAnyExisting'][suburb ? suburb.id : 0].push(feature)

    callback()
  }
})
const candidatesNewAddressesWithoutConflicts = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, _encoding, callback) {
    sourceCount++

    if (process.stdout.isTTY && sourceCount % 1000 === 0) {
      process.stdout.write(` ${sourceCount.toLocaleString()}\r`)
    }

    // remove tracing properties
    delete feature.properties._pfi

    const suburb = findSuburb(feature)

    outputFeatures['newAddressesWithoutConflicts'][suburb ? suburb.id : 0].push(feature)

    callback()
  }
})

/**
 * Save our candidate address data as .osm files by layer by suburb
 */
function outputCandidates() {
  let i = 0
  for (const layer of Object.keys(outputFeatures)) {
    i++
    let j = 0
    for (const suburbId of Object.keys(outputFeatures[layer])) {
      j++
      if (process.stdout.isTTY && i % 10 === 0) {
        process.stdout.write(` ${j.toLocaleString()}/${Object.keys(outputFeatures).length.toLocaleString()} - ${layer} - ${i.toLocaleString()}/${suburbs.length.toLocaleString()}\r`)
      }

      const suburbFeatures = outputFeatures[layer][suburbId]
      if (suburbFeatures && suburbFeatures.length) {
        const xml = geojsontoosm(suburbFeatures)
        fs.writeFileSync(path.join(outputPath, layer, `${suburbId}_${suburbName[suburbId]}.osm`), xml)
      } // else no data for this suburb
    }
  }
}

// first pass to index by geometry
console.log('Step 1/4: Reading suburbs')
pipeline(
  fs.createReadStream(suburbsFile),
  ndjson.parse(),
  readSuburbs,
  err => {
    if (err) {
      console.log(err)
      process.exit(1)
    } else {
      for (const layer of Object.keys(outputFeatures)) {
        // plus one for features not within any suburb
        outputFeatures[layer][0] = []
      }
      suburbName[0] = 'OUTSIDE VIC SUBURB'

      console.log('Step 2/4: Creating index of Suburbs')
      lookupSuburbs = new PolygonLookup({
        type: 'FeatureCollection',
        features: suburbs
      })

      console.log('Step 3/4: noOSMAddressWithinBlock')
      pipeline(
        fs.createReadStream(path.join(conflatePath, 'noOSMAddressWithinBlock.geojson')),
        ndjson.parse(),
        candidatesNewAddressesInBlocksWithoutAnyExisting,
        err => {
          if (err) {
            console.log(err)
            process.exit(1)
          } else {

            console.log('Step 4/4: noExactMatch')
            pipeline(
              fs.createReadStream(path.join(conflatePath, 'noExactMatch.geojson')),
              ndjson.parse(),
              candidatesNewAddressesWithoutConflicts,
              err => {
                if (err) {
                  console.log(err)
                  process.exit(1)
                } else {
                  console.log('Output candidate .osm files')
                  outputCandidates()
                  process.exit(0)
                }
              }
            )
          }
        }
      )

    }
  }
)
