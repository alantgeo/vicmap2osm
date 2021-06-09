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
  .option('preserve-derivable-properties', {
    type: 'boolean',
    default: false,
    description: 'If set, preserves addr:suburb, addr:postcode, addr:state, otherwise omits them'
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

// output Vicmap complex name data
const complexStream = ndjson.stringify()
const complexStreamOutput = complexStream.pipe(fs.createWriteStream(`dist/vicmap-complex.geojson`))

// output Vicmap building name data
const buildingStream = ndjson.stringify()
const buildingStreamOutput = buildingStream.pipe(fs.createWriteStream(`dist/vicmap-building.geojson`))

let sourceCount = 0
const transform = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    sourceCount++

    if (!argv.quiet) {
      if (process.stdout.isTTY && sourceCount % 10000 === 0) {
        process.stdout.write(` ${sourceCount.toLocaleString()}\r`)
      }
    }

    if (feature.properties.COMPLEX) {
      const complexFeature = {
        type: 'Feature',
        properties: {
          name: feature.properties.COMPLEX
        },
        geometry: feature.geometry
      }
      complexStream.write(complexFeature)
    }

    // convert source Feature into a Feature per the OSM schema
    const osm = toOSM(feature, {
      tracing: argv.tracing,
      /* omit addr:suburb, addr:postcode, addr:state */
      includeDerivableProperties: argv.preserveDerivableProperties
    })

    if (feature.properties.BUILDING) {
      const buildingFeature = {
        type: 'Feature',
        properties: Object.assign({}, osm.properties, {
          name: feature.properties.BUILDING
        }),
        geometry: osm.geometry
      }
      buildingStream.write(buildingFeature)
    }

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
      complexStream.end()
      buildingStream.end()
      complexStreamOutput.on('finish', () => {
        console.log(`saved dist/vicmap-complex.geojson`)
        buildingStreamOutput.on('finish', () => {
          console.log(`saved dist/vicmap-building.geojson`)
          process.exit(0)
        })
      })
    }
  }
)
