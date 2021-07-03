#!/usr/bin/env node

/**
 * Find OSM streets with abbreviated street types
 */

const fs = require('fs')
const { Transform, pipeline } = require('stream')
const ndjson = require('ndjson')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .argv

if (argv._.length < 2) {
  console.error("Usage: ./findAbbrStreets.js input.geojson output.geojson")
  process.exit(1)
}

const inputFile = argv._[0]
const outputFile = argv._[1]

const abbreviatedTypes = ['rd', 'st', 'ave', 'av', 'ln', 'cl', 'hwy', 'pl']
const streetTypes = {
  'rd': 'Road',
  'st': 'Street',
  'ave': 'Avenue',
  'av': 'Avenue',
  'ln': 'Lane',
  'hwy': 'Highway',
  'pl': 'Place',
  'fwy': 'Freeway',
  'pde': 'Parade',
  'dr': 'Drive',
  'cr': 'Crescent',
  'cl': 'Close',
  'ct': 'Court'
}

if (!fs.existsSync(inputFile)) {
  console.error(`${inputFile} not found`)
  process.exit(1)
}

let index = 0
let tasks = 0
const checkStreet = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    index++

    if (process.stdout.isTTY && index % 10000 === 0) {
      process.stdout.write(` ${index.toLocaleString()}\r`)
    }

    if ('addr:street' in feature.properties) {
      const street = feature.properties['addr:street'].toLowerCase()
      const streetEndsWithAbbr = abbreviatedTypes.map(ab => street.endsWith(` ${ab}`)).reduce((acc, cur) => acc || cur)
      if (streetEndsWithAbbr) {
        const matches = street.match(/ (rd|st|ave|av|ln|cl|hwy|pl|fwy|pde|dr|cr|cl|ct)$/)
        if (matches.length) {
          const ab = matches[1]
          const expandedStreetType = streetTypes[ab]
          const fullStreetName = feature.properties['addr:street'].replace(/ (rd|st|ave|av|ln|cl|hwy|pl|fwy|pde|dr|cr|cl|ct)$/i, ` ${expandedStreetType}`)

          // MapRoulette task
          const task = {
            type: 'FeatureCollection',
            features: [ feature ],
            cooperativeWork: {
              meta: {
                version: 2,
                type: 1 // tag fix type
              },
              operations: [{
                operationType: 'modifyElement',
                data: {
                  id: `${feature.properties['@type']}/${feature.properties['@id']}`,
                  operations: [{
                    operation: 'setTags',
                    data: {
                      'addr:street': fullStreetName
                    }
                  }]
                }
              }]
            }
          }
          tasks++
          this.push(task)
        }
      }
    }

    callback()
  }
})

pipeline(
  fs.createReadStream(inputFile),
  ndjson.parse(),
  checkStreet,
  ndjson.stringify(),
  fs.createWriteStream(outputFile),
  err => {
    if (err) {
      console.log(err)
      process.exit(1)
    } else {
      console.log(`${tasks} tasks`)
      process.exit(0)
    }
  }
)
