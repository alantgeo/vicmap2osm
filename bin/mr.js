#!/usr/bin/env node

/**
 * Create a MapRoulette Cooperative Challenge from the exact matches,
 * which suggests updating the OSM objects tags with those from Vicmap.
 * 
 * https://github.com/osmlab/maproulette3/wiki/Cooperative-Challenges
 */

// TODO need a higher level json structre
// TODO maybe these need to be grouped by block?

const fs = require('fs')
const { Transform, pipeline } = require('stream')
const ndjson = require('ndjson')
const omit = require('object.omit')
const path = require('path')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .argv

if (argv._.length < 2) {
  console.error("Usage: ./mr.js dist/conflate dist/mr.geojson")
  process.exit(1)
}

const sourceDirectory = argv._[0]
const outputFile = argv._[1]

if (!fs.existsSync(path.join(sourceDirectory, 'exactMatch.geojson'))) {
  console.error(`${path.join(sourceDirectory, 'exactMatch.geojson')} not found`)
  process.exit(1)
}

let sourceCount = 0
const mr = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    sourceCount++

    if (process.stdout.isTTY && sourceCount % 10000 === 0) {
      process.stdout.write(` ${sourceCount / 1000}k\r`)
    }

    const matches = feature.properties._matches.split(',')

    for (const match of matches) {
      const operation = {
        operationType: 'modifyElement',
        data: {
          id: match,
          operations: [{
            operation: 'setTags',
            data: omit(feature.properties, '_matches')
          }]
        }
      }

      this.push(operation)
    }

    callback()
  }
})

pipeline(
  fs.createReadStream(path.join(sourceDirectory, 'exactMatch.geojson')),
  ndjson.parse(),
  mr,
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
