#!/usr/bin/env node

/**
 * Compare the addr:suburb reported from Vicmap which the corresponding suburb/locality boundary existing in OSM
 */

const fs = require('fs')
const { Transform, pipeline } = require('stream')
const ndjson = require('ndjson')
const PolygonLookup = require('polygon-lookup')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .option('verbose', {
    type: 'boolean',
    description: 'Verbose logging'
  })
  .argv

if (argv._.length < 3) {
  console.error("Usage: ./compareSuburb.js vicmap-osm.geojson osm_admin_level_10.geojson output.geojson")
  process.exit(1)
}

const vicmapFile = argv._[0]
const osmFile = argv._[1]
const outputFile = argv._[2]

if (!fs.existsSync(vicmapFile)) {
  console.error(`${vicmapFile} not found`)
  process.exit(1)
}
if (!fs.existsSync(osmFile)) {
  console.error(`${osmFile} not found`)
  process.exit(1)
}

const osmFeatures = fs.readFileSync(osmFile, 'utf-8').toString().split('\n')
  .filter(line => line !== '')
  .map((line, index) => {
    try {
      return JSON.parse(line)
    } catch {
      console.log(`Error parsing line ${index} of ${osmFile}: ${line}`)
    }
  })

console.log('Creating index for OSM Admin Boundaries lookup')
const lookup = new PolygonLookup({
  type: 'FeatureCollection',
  features: osmFeatures
})

// conflate vicmap addresses with OSM addresses
let sourceCount = 0
const compare = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    sourceCount++

    if (process.stdout.isTTY && sourceCount % 10000 === 0) {
      process.stdout.write(` ${sourceCount.toLocaleString()}\r`)
    }

    // find which block this vicmap address is in
    const results = lookup.search(...feature.geometry.coordinates.slice(0, 2), 1)
    const osmFeature = results ? (results.type === 'FeatureCollection' ? (results.features ? results.features[0] : null) : results) : null
    if (osmFeature) {
      // address within an OSM suburb
      if (feature.properties['addr:suburb'] !== osmFeature.properties['name']) {
        // Vicmap suburb different to OSM admin_level=10
        // console.log('Suburb differs', feature.properties['addr:suburb'], osmFeature.properties['name'])
        feature.properties._osmSuburb = osmFeature.properties['name']
        this.push(feature)
      }
    } else {
      // address not found within any OSM suburb
      // console.log('Not found within any OSM suburb', feature)
      this.push(feature)
    }

    callback()
  }
})

console.log('Pass 1/1: Find Vicmap addresses where the suburb differs with OSM admin boundaries')
pipeline(
  fs.createReadStream(vicmapFile),
  ndjson.parse(),
  compare,
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
