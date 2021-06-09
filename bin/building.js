#!/usr/bin/env node

/**
 * Take Vicmap address points which have a building name,
 * then conflate with existing OSM names
 */

const fs = require('fs')
const { Transform, pipeline } = require('readable-stream')
const ndjson = require('ndjson')
const point = require('@turf/helpers').point
const { capitalCase } = require('capital-case')
const Flatbush = require('flatbush')
const bbox = require('@turf/bbox').default
const { around } = require('geoflatbush')
const { lcs } = require('string-comparison')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .argv

if (argv._.length < 3) {
  console.error("Usage: ./building.js vicmap-building.geojson victoria-named-features.osm.geojson vicmap-building-conflation")
  process.exit(1)
}

const inputFile = argv._[0]
const osmFile = argv._[1]
const outputPath = argv._[2]

if (!fs.existsSync(inputFile)) {
  console.error(`${inputFile} not found`)
  process.exit(1)
}

console.log('Reading OSM data')
const osmFeatures = fs.readFileSync(osmFile, 'utf-8').toString().split('\n')
  .filter(line => line !== '')
  .map((line, index, array) => {
    if (process.stdout.isTTY && index % 1000 === 0) {
      process.stdout.write(` ${index.toLocaleString()}/${array.length.toLocaleString()} (${Math.round(index / array.length * 100)}%)\r`)
    }

    try {
      const feature = JSON.parse(line)
      feature.properties.id = index
      return feature
    } catch {
      console.log(`Error parsing line ${index} of ${osmFile}: ${line}`)
    }
  })

console.log('Creating index for nearby OSM search')
const osmIndex = new Flatbush(osmFeatures.length)
for (const osmFeature of osmFeatures) {
  osmIndex.add(...bbox(osmFeature))
}
osmIndex.finish()

// ndjson streams to output features
const outputKeys = [
  // MapRoulette challenges
  'mr_singleNearbySimilarFeature',
  'mr_multipleNearbySimilarFeatures',
  'mr_noNearbySimilarFeature'
]
const outputStreams = {}
const outputStreamOutputs = {}

outputKeys.forEach(key => {
  outputStreams[key] = ndjson.stringify()
  outputStreamOutputs[key] = outputStreams[key].pipe(fs.createWriteStream(`${outputPath}/${key}.geojson`))
})

let sourceCount = 0
const conflate = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    sourceCount++

    if (!argv.quiet) {
      if (process.stdout.isTTY && sourceCount % 100 === 0) {
        process.stdout.write(` ${sourceCount.toLocaleString()}\r`)
      }
    }

    const name = feature.properties.name
    const properties = {
      name: capitalCase(name)
    }

    // find nearby matching OSM feature
    const maxDistanceInKm = 1
    const nearby = around(osmIndex, ...feature.geometry.coordinates, Infinity, maxDistanceInKm)
    const nearbyMatches = nearby.filter(i => {
      const similarity = lcs.similarity(osmFeatures[i].properties.name.toLowerCase(), name.toLowerCase())
      return similarity > 0.8
    })
    const nearbyMatchedFeatures = nearbyMatches.map(i => osmFeatures[i])

    /* TODO log to file
    if (nearbyMatches.length) {
      console.log(name)
      console.log(' > ', nearbyMatches.map(i => osmFeatures[i].properties.name))
    }
    */
    if (nearbyMatches.length === 1) {
      // a single nearby OSM features found with similar name
      if (nearbyMatchedFeatures[0].properties.name.toLowerCase === name.toLowerCase()) {
        // name exactly matched
        console.log(`Exact match: ${properties.name} = ${nearbyMatchedFeatures[0].properties.name}`)
      } else {
        // name was similar but not an exact match
        // create a MapRoulette task to investigate further
        const task = {
          type: 'FeatureCollection',
          features: [
            point(feature.geometry.coordinates, Object.assign({}, feature.properties, {
              'marker-color': 'orange',
              'marker-size': 'large',
              'OSM Name': nearbyMatchedFeatures[0].properties.name
            }, properties)),
            ...nearbyMatchedFeatures
          ]
        }
        outputStreams.mr_singleNearbySimilarFeature.write(task)
      }
    } else if (nearbyMatches.length > 1) {
      // multiple nearby OSM features found with similar name, create a MapRoulette task to investigate further
      const task = {
        type: 'FeatureCollection',
        features: [
          point(feature.geometry.coordinates, Object.assign({}, feature.properties, {
            'marker-color': 'orange',
            'marker-size': 'large'
          }, properties)),
          ...nearbyMatchedFeatures
        ]
      }
      outputStreams.mr_multipleNearbySimilarFeatures.write(task)
    } else {
      // no nearby OSM feature found with similar name, so create a MapRoulette task
      const task = {
        type: 'FeatureCollection',
        features: [
          point(feature.geometry.coordinates, Object.assign({}, feature.properties, properties))
        ]
      }
      outputStreams.mr_noNearbySimilarFeature.write(task)
    }

    callback()
  }
})

console.log('Stage 1/1 reading Vicmap building points')
pipeline(
  fs.createReadStream(inputFile),
  ndjson.parse(),
  conflate,
  (err) => {
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
