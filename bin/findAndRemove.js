#!/usr/bin/env node

// There was an issue in the Stage 3 import where some nodes were uploaded with corrupted data.
// The problematic nodes were found with
//     ./bin/reportOverlap.js dist/conflate/noOSMAddressWithinBlock.geojson dist/conflate/noOSMAddressWithinBlock.overlaps.geojson
// with the resulting locations saved at dist/conflate/noOSMAddressWithinBlock.overlaps.geojson
//
// Next we find source nodes from the OSM files in dist/candidates, and the actual uploaded node IDs.
// Next we construct an OSC file to delete these from OSM.
// Then we prepare a new OSM file with just the corrected nodes to be uploaded again.

const fs = require('fs')
const { Readable, Transform, pipeline } = require('stream')
const ndjson = require('ndjson')
const xml = require('xml-js')
const path = require('path')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .argv

if (argv._.length < 4) {
  console.error("Usage: ./findAndRemove.js needles.geojson hackstack nodesToDelete.txt locationsToReInsert.txt")
  process.exit(1)
}

const needlesFile = argv._[0]
const hackstackPath = argv._[1]
const nodesToDeleteFile = argv._[2]
const locationsToReInsertFile = argv._[3]

if (!fs.existsSync(needlesFile)) {
  console.error(`${needlesFile} not found`)
  process.exit(1)
}

let needlesCount = 0
const needles = {}

/**
 * Index features by geometry. Used as a first pass, so a second pass can easily compare
 * features with the same geometry.
 */
const index = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, _encoding, callback) {
    needlesCount++

    if (!argv.quiet) {
      if (process.stdout.isTTY && needlesCount % 10000 === 0) {
        process.stdout.write(` ${needlesCount.toLocaleString()}\r`)
      }
    }

    const geometryKey = feature.geometry.coordinates.join(',')

    if (!(geometryKey in needles)) {
      needles[geometryKey] = []
    }
    needles[geometryKey].push(true)

    callback()
  }
})

// first pass to index by geometry
console.log('Pass 1/2: index by geometry')
pipeline(
  fs.createReadStream(needlesFile),
  ndjson.parse(),
  index,
  err => {
    if (err) {
      console.log(err)
      process.exit(1)
    } else {
      const hackstackFiles = fs.readdirSync(hackstackPath).filter(file => file.endsWith('.osm'))
      const idsToDelete = []
      const locationsToReInsert = []

      let i = 0
      for (const hackstackFile of hackstackFiles) {
        i++
        console.log(`${i}/${hackstackFiles.length} ${hackstackFile}`)
        const osmText = fs.readFileSync(path.join(hackstackPath, hackstackFile))
        const diffText = fs.readFileSync(path.join(hackstackPath, hackstackFile.replace(/\.osm$/, '.diff.xml')))
        const osm = JSON.parse(xml.xml2json(osmText, { compact: true }))
        const diff = JSON.parse(xml.xml2json(diffText, { compact: true }))

        const oldIdToNewId = {}

        if (diff?.diffResult?.node) {
          for (const node of Array.isArray(diff.diffResult.node) ? diff.diffResult.node : (diff.diffResult.node.length ? [diff.diffResult.node] : [])) {
            oldIdToNewId[node._attributes.old_id] = node._attributes.new_id
          }
        }

        if (osm?.osm?.node) {
          for (const node of Array.isArray(osm.osm.node) ? osm.osm.node : (osm.osm.node.length ? [osm.osm.node] : [])) {
            const geometryKey = [ node._attributes.lon, node._attributes.lat].join(',')
            if (geometryKey in needles) {
              const negativeId = node._attributes.id
              if (negativeId in oldIdToNewId) {
                const positiveId = oldIdToNewId[negativeId]
                idsToDelete.push(positiveId)
                locationsToReInsert.push(geometryKey)
              } else {
                console.error(`Couldn't find ID ${negativeID} in diff`)
                process.exit(1)
              }
            }
          }
        }
      }
      fs.writeFileSync(nodesToDeleteFile, idsToDelete.join(' '))
      fs.writeFileSync(locationsToReInsertFile, locationsToReInsert.join('\n'))
      console.log(`${idsToDelete.length} Node IDs to delete: ${nodesToDeleteFile}`)
      console.log(`${locationsToReInsert.length} Locations to reinsert: ${locationsToReInsertFile}`)
    }
  }
)



