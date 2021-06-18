#!/usr/bin/env node

/**
 * Report features which overlap
 */

const fs = require('fs')
const { Readable, Transform, pipeline } = require('stream')
const ndjson = require('ndjson')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .argv

if (argv._.length < 2) {
  console.error("Usage: ./reportOverlap.js input.geojson output.geojson")
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

/**
 * Index features by geometry. Used as a first pass, so a second pass can easily compare
 * features with the same geometry.
 */
const index = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    sourceCount++

    if (!argv.quiet) {
      if (process.stdout.isTTY && sourceCount % 10000 === 0) {
        process.stdout.write(` ${sourceCount.toLocaleString()}\r`)
      }
    }

    const geometryKey = feature.geometry.coordinates.join(',')

    if (!(geometryKey in features)) {
      features[geometryKey] = []
    }
    features[geometryKey].push(feature)

    callback()
  }
})

let totalFeaturesWhichOverlap = 0
let countGroupsOfOverlaps = 0

/**
 * Report features with the same geometry.
 */
let featureIndex = 0
const reportOverlap = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(key, encoding, callback) {
    featureIndex++
    if (!argv.quiet) {
      if (process.stdout.isTTY && featureIndex % 10000 === 0) {
        process.stdout.write(` ${featureIndex.toLocaleString()} / ${sourceCount.toLocaleString()} (${Math.round(featureIndex / sourceCount * 100)}%)\r`)
      }
    }

    const sharedGeometry = features[key]

    if (sharedGeometry.length === 1) {
      // only one feature with this geometry
    } else {
      totalFeaturesWhichOverlap += sharedGeometry.length
      countGroupsOfOverlaps++
      this.push({
        type: 'Feature',
        properties: {
          count: sharedGeometry.length
        },
        geometry: sharedGeometry[0].geometry
      })
    }

    callback()
  }
})

// first pass to index by geometry
console.log('Pass 1/2: index by geometry')
pipeline(
  fs.createReadStream(inputFile),
  ndjson.parse(),
  index,
  err => {
    if (err) {
      console.log(err)
      process.exit(1)
    } else {
      console.log(`  of ${sourceCount.toLocaleString()} features found ${Object.keys(features).length.toLocaleString()} unique geometries`)
      // second pass to report overlapping features
      console.log('Pass 2/2: report overlapping features')
      pipeline(
        Readable.from(Object.keys(features)),
        reportOverlap,
        ndjson.stringify(),
        fs.createWriteStream(outputFile),
        err => {
          if (err) {
            console.log(err)
            process.exit(1)
          } else {
            console.log(`Total overlapping features: ${totalFeaturesWhichOverlap}`)
            console.log(`Locations with overlapping features: ${countGroupsOfOverlaps}`)
            process.exit(0)
          }
        }
      )
    }
  }
)
