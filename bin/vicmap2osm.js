#!/usr/bin/env node

/**
 * Convert from Vicmap Address schema into OSM Address schema, and omit some addresses
 */

const fs = require('fs')
const { Transform, pipeline } = require('readable-stream')
const ndjson = require('ndjson')
const toOSM = require('../lib/toOSM.js')
const filterOSM = require('../lib/filterOSM.js')
const filterSource = require('../lib/filterSource.js')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .option('debug', {
    type: 'boolean',
    description: 'Dumps full debug logs'
  })
  .option('tracing', {
    type: 'boolean',
    description: 'Includes _pfi tags to aid debugging'
  })
  .argv

if (argv._.length < 2) {
  console.error("Usage: ./vicmap2osm.js input.geojson output.geojson")
  process.exit(1)
}

const inputFile = argv._[0]
const outputFile = argv._[1]

if (!fs.existsSync(inputFile)) {
  console.error(`${inputFile} not found`)
  process.exit(1)
}

let sourceCount = 0
const transform = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    if (!argv.quiet) {
      if (process.stdout.isTTY && sourceCount % 10000 === 0) {
        process.stdout.write(` ${sourceCount / 1000}k\r`)
      }
    }

    // convert source Feature into a Feature per the OSM schema
    const osm = toOSM(feature, {
      tracing: argv.tracing
    })

    // some addresses we skip importing into OSM, see README.md#omitted-addresses
    if (filterOSM(osm) && filterSource(feature)) {
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
