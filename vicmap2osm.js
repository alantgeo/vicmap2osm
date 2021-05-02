#!/usr/bin/env node

const fs = require('fs')
const { Transform, pipeline } = require('readable-stream')
const ndjson = require('ndjson')
const toOSM = require('./toOSM.js')
const filterOSM = require('./filterOSM.js')

const args = process.argv.slice(2)

if (args.length < 2) {
  console.error("Usage: ./vicmap2osm.js input.geojson output.geojson")
  process.exit(1)
}

const inputFile = args[0]
const outputFile = args[1]

if (!fs.existsSync(inputFile)) {
  console.error(`${inputFile} not found`)
  process.exit(1)
}

const transform = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    // convert source Feature into a Feature per the OSM schema
    const osm = toOSM(feature)

    // some addresses we skip importing into OSM
    if (filterOSM(osm)) {
      this.push(osm)
    }

    callback()
  }
})

// stream in source ndjson, transfom and stream out
pipeline(
  fs.createReadStream(inputFile),
  ndjson.parse(),
  transform,
  ndjson.stringify(),
  fs.createWriteStream(outputFile),
  (err) => {
    if (err) {
      console.log(err)
      process.exit(1)
    } else {
      process.exit(0)
    }
  }
)
