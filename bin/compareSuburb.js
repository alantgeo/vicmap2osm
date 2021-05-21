#!/usr/bin/env node

/**
 * Compare the addr:suburb reported from Vicmap with the corresponding suburb/locality boundary existing in OSM
 * to report any Vicmap addresses where addr:suburb conflicts with OSM's boundaries
 * 
 * For each OSM suburb/locality, report the distribution of Vicmap addr:postcode's falling with the boundary.
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

if (argv._.length < 4) {
  console.error("Usage: ./compareSuburb.js vicmap-osm.geojson osm_admin_level_10.geojson dist/vicmapSuburbDiffersWithOSM.geojson dist/suburbsWithPostcodeCounts.geojson")
  process.exit(1)
}

const vicmapFile = argv._[0]
const osmFile = argv._[1]
const outputFile = argv._[2]
const postcodeOutputFile = argv._[3]

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
      const feature = JSON.parse(line)
      feature.properties.id = index
      return feature
    } catch {
      console.log(`Error parsing line ${index} of ${osmFile}: ${line}`)
    }
  })

console.log('Creating index for OSM Admin Boundaries lookup')
const lookup = new PolygonLookup({
  type: 'FeatureCollection',
  features: osmFeatures
})

// postcode counts by OSM admin boundary id
/*
{
  0: {
    '3000': address count
  }
}
*/
const postcodes = {}

// compare vicmap addr:suburb with OSM boundary
// report vicmap addr:postcode by OSM boundary
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

      // postcodes by OSM suburb
      const postcode = feature.properties['addr:postcode']
      if (!(osmFeature.properties.id in postcodes)) {
        postcodes[osmFeature.properties.id] = {}
      }
      if (!(postcode in postcodes[osmFeature.properties.id])) {
        postcodes[osmFeature.properties.id][postcode] = 0
      }

      postcodes[osmFeature.properties.id][postcode] += 1
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
      const suburbsWithPostcodeCountsStream = ndjson.stringify()
      const suburbsWithPostcodeCountsOutput = suburbsWithPostcodeCountsStream.pipe(fs.createWriteStream(postcodeOutputFile))
      osmFeatures.forEach((feature, index) => {
        const postcodesFoundInThisSuburb = index in postcodes ? Object.keys(postcodes[index]) : {}
        const postcodeCounts = []
        for (const [postcode, count] of Object.entries(index in postcodes ? postcodes[index] : {})) {
          postcodeCounts.push({
            postcode,
            count
          })
        }
        const sortedPostcodeCounts = postcodeCounts.sort((a, b) => b.count - a.count)

        feature.properties._distinctPostcodes = postcodesFoundInThisSuburb.length

        sortedPostcodeCounts.forEach((postcodeCount, index) => {
          feature.properties[`_postcode_${index + 1}`] = postcodeCount.postcode
          feature.properties[`_postcode_count_${index + 1}`] = postcodeCount.count
        })

        suburbsWithPostcodeCountsStream.write(feature)
      })
      suburbsWithPostcodeCountsStream.end()

      suburbsWithPostcodeCountsOutput.on('finish', () => {
        console.log(`saved ${postcodeOutputFile}`)
        process.exit(0)
      })
    }
  }
)
