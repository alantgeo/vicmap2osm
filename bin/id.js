#!/usr/bin/env node

/**
 * Set GeoJSON id
 */

const fs = require('fs')
const { Transform, pipeline } = require('stream')
const ndjson = require('ndjson')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .option('property', {
    type: 'boolean',
    description: 'Also set id as a property'
  })
  .argv

if (argv._.length < 2) {
  console.error("Usage: ./id.js input.geojson output.geojson")
  process.exit(1)
}

const inputFile = argv._[0]
const outputFile = argv._[1]

if (!fs.existsSync(inputFile)) {
  console.error(`${inputFile} not found`)
  process.exit(1)
}

let index = 0
const id = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    index++

    if (process.stdout.isTTY && index % 10000 === 0) {
      process.stdout.write(` ${index.toLocaleString()}\r`)
    }

    feature.id = index

    if (argv.property) {
      feature.properties.id = index
    }

    this.push(feature)

    callback()
  }
})

pipeline(
  fs.createReadStream(inputFile),
  ndjson.parse(),
  id,
  ndjson.stringify(),
  fs.createWriteStream(outputFile),
  err => {
    if (err) {
      console.log(err)
      process.exit(1)
    } else {
      process.exit(0)
    }
  }
)
