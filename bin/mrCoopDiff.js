#!/usr/bin/env node

/**
 * Takes a MapRoulette Cooperative Challenge file and creates a JSON with before and after for visualisation
 */

const fs = require('fs')
const { Readable, Transform, pipeline } = require('stream')
const ndjson = require('ndjson')
const cloneDeep = require('clone-deep')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .argv

if (argv._.length < 2) {
  console.error("Usage: ./mrCoopDiff.js input.json output.json")
  process.exit(1)
}

const inputFile = argv._[0]
const outputFile = argv._[1]

if (!fs.existsSync(inputFile)) {
  console.error(`${inputFile} not found`)
  process.exit(1)
}

let challengeCount = 0
const features = {}

const applyOperations = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(challenge, encoding, callback) {
    challengeCount++

    if (argv.n && challengeCount > argv.n) {
      callback()
      return
    }

    if (!argv.quiet) {
      if (process.stdout.isTTY && challengeCount % 1000 === 0) {
        process.stdout.write(` ${challengeCount.toLocaleString()}\r`)
      }
    }

    for (const feature of challenge.features) {
      const key = `${feature.properties['@type']}/${feature.properties['@id']}`
      if (key in features) {
        console.log(`${key} was found a second time`)
      }

      features[key] = {
        before: feature
      }
    }

    if (challenge && challenge.cooperativeWork && challenge.cooperativeWork.operations) {
      for (const operation of challenge.cooperativeWork.operations) {
        if (operation.operationType === 'modifyElement' && operation.data) {
          const id = operation.data.id
          if (id in features) {
            const afterFeature = cloneDeep(features[id].before)
            for (const featureOperation of operation.data.operations) {
              if (featureOperation.operation === 'setTags') {
                for (const [key, value] of Object.entries(featureOperation.data)) {
                  afterFeature.properties[key] = value
                }
              }
            }
            features[id].after = afterFeature
          }
        }
      }
    }

    callback()
  }
})

console.log('Converting challenges into diff previews')
pipeline(
  fs.createReadStream(inputFile),
  ndjson.parse(),
  applyOperations,
  err => {
    if (err) {
      console.log(err)
      process.exit(1)
    } else {
      fs.writeFileSync(outputFile, JSON.stringify(features))
      process.exit(0)
    }
  }
)
