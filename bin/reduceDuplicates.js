#!/usr/bin/env node

/**
 * Remove duplicates (exact tags) at the same location or within a small proximity.
 */

const fs = require('fs')
const { Readable, Transform, pipeline } = require('stream')
const ndjson = require('ndjson')
const cluster = require('../lib/cluster.js')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .option('debug', {
    type: 'boolean',
    description: 'Dumps full debug logs'
  })
  .argv

if (argv._.length < 2) {
  console.error("Usage: ./reduceDuplicates.js input.geojson output.geojson")
  process.exit(1)
}

const inputFile = argv._[0]
const outputFile = argv._[1]

if (!fs.existsSync(inputFile)) {
  console.error(`${inputFile} not found`)
  process.exit(1)
}

let sourceCount = 0
const features = {}

const index = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    sourceCount++

    if (sourceCount % 10000 === 0) {
      process.stdout.write(` ${sourceCount / 1000}k\r`)
    }

    const key = [
      feature.properties['addr:unit'],
      feature.properties['addr:housenumber'],
      feature.properties['addr:street'],
      feature.properties['addr:suburb'],
      feature.properties['addr:state'],
      feature.properties['addr:postcode']
    ].join('/')

    if (!(key in features)) {
      features[key] = []
    }
    features[key].push(feature)

    callback()
  }
})

let reduceIndex = 0
const reduce = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(key, encoding, callback) {
    reduceIndex++
    if (reduceIndex % 10000 === 0) {
      process.stdout.write(` ${reduceIndex / 1000}k / ${Math.round(sourceCount / 1000)}k (${Math.round(reduceIndex / sourceCount * 100)}%)\r`)
    }

    const groupedFeatures = features[key]
    if (groupedFeatures.length === 1) {
      // address not duplicated

      this.push(groupedFeatures[0])
    } else {
      // address appears multiple times

      const sameCoordinates = [...new Set(groupedFeatures.map(f => f.geometry.coordinates.join(',')))].length <= 1
      if (sameCoordinates) {
        // features have same properties and same geometry, so true duplicates can reduce to one
        this.push(groupedFeatures[0])
      } else {
        // cluster features with a threshold of 25m
        const clusters = cluster(groupedFeatures, 25)

        // if clustered into a single cluster, then output a single average feature
        if (clusters.length === 1) {
          const averageCoordinates = [
            groupedFeatures.map(f => f.geometry.coordinates[0]).reduce((acc, cur) => acc + cur) / groupedFeatures.length,
            groupedFeatures.map(f => f.geometry.coordinates[1]).reduce((acc, cur) => acc + cur) / groupedFeatures.length
          ]
          const averageFeature = groupedFeatures[0]
          averageFeature.geometry.coordinates = averageCoordinates

          this.push(averageFeature)
        } else {
          // more than one cluster, reduce those clustered into one, and then report all the results
          const clusterAverages = clusters.map(cluster => {
            if (cluster.length === 1) {
              return cluster[0]
            } else {
              const averageCoordinates = [
                cluster.map(f => f.geometry.coordinates[0]).reduce((acc, cur) => acc + cur) / cluster.length,
                cluster.map(f => f.geometry.coordinates[1]).reduce((acc, cur) => acc + cur) / cluster.length
              ]
              const averageFeature = cluster[0]
              averageFeature.geometry.coordinates = averageCoordinates
              return averageFeature
            }
          })

          // report these as address points with the same attributes but different locations beyond the threshold
          if (debugDuplicateAddressStream) {
            const webOfMatches = {
              type: 'Feature',
              properties: clusterAverages[0].properties,
              geometry: {
                type: 'LineString',
                coordinates: clusterAverages.map(p => p.geometry.coordinates)
              }
            }
            debugDuplicateAddressStream.write(webOfMatches)
          }
        }
      }
    }

    callback()
  }
})

const debugDuplicateAddressStream = argv.debug ? ndjson.stringify() : null

let debugApplicationsAddressStreamOutput
if (debugDuplicateAddressStream) {
  debugApplicationsAddressStreamOutput = debugDuplicateAddressStream.pipe(fs.createWriteStream('debug/reduceDuplicates/duplicateAddresses.geojson'))
}

// first pass to index by geometry
console.log('First pass to index by address properties')
pipeline(
  fs.createReadStream(inputFile),
  ndjson.parse(),
  index,
  err => {
    if (err) {
      console.log(err)
      process.exit(1)
    } else {
      console.log(`  of ${sourceCount} features found ${Object.keys(features).length} unique addresses`)
      // second pass to reduce overlapping features
      pipeline(
        Readable.from(Object.keys(features)),
        reduce,
        ndjson.stringify(),
        fs.createWriteStream(outputFile),
        err => {
          if (err) {
            console.log(err)
            process.exit(1)
          } else {
            if (debugDuplicateAddressStream) {
              debugDuplicateAddressStream.end()
            }
            if (debugApplicationsAddressStreamOutput) {
              debugApplicationsAddressStreamOutput.on('finish', () => {
                console.log('saved debug/reduceDuplicates/duplicateAddresses.geojson')
                process.exit(0)
              })
            } else {
              process.exit(0)
            }
          }
        }
      )
    }
  }
)
