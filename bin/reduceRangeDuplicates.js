#!/usr/bin/env node

/**
 * Remove duplicates created by addresses from a range also appearing individually
 * eg.
 *  - 304-306 Cardigan Street Carlton - range can be removed since each individual address exists
 *  - 304 Cardigan Street Calton
 *  - 306 Cardigan Street Calton
 * 
 *  - 249-263 Faraday Street
 *  - 251 Faraday Street - removed since not all addresses from the range exist, but this one is covered by the range
 * 
 */

const fs = require('fs')
const { Transform, pipeline } = require('stream')
const ndjson = require('ndjson')
const withinRange = require('../lib/withinRange.js')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .option('debug', {
    type: 'boolean',
    description: 'Dumps full debug logs'
  })
  .option('verbose', {
    type: 'boolean',
    description: 'Verbose logging'
  })
  .argv

if (argv._.length < 2) {
  console.error("Usage: ./reduceRangeDuplicates.js input.geojson output.geojson")
  process.exit(1)
}

const inputFile = argv._[0]
const outputFile = argv._[1]

if (!fs.existsSync(inputFile)) {
  console.error(`${inputFile} not found`)
  process.exit(1)
}

function hash(feature) {
  return [
    feature.properties['addr:housenumber'],
    feature.properties['addr:street'],
    feature.properties['addr:suburb'],
    feature.properties['addr:state'],
    feature.properties['addr:postcode']
  ].join('/')
}

let sourceCount = 0

const ranges = []
const nonRangesByStreet = {}
const rangesRemovedInFilterA = {}

// index all non-range addresses by street, suburb, state, postcode
const index = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    sourceCount++

    if (process.stdout.isTTY && sourceCount % 10000 === 0) {
      process.stdout.write(` ${sourceCount / 1000}k\r`)
    }

    const isRange = feature.properties['addr:housenumber'].split('-').length > 1

    if (isRange) {
      ranges.push(feature)
    } else {
      const key = [
        feature.properties['addr:street'],
        feature.properties['addr:suburb'],
        feature.properties['addr:state'],
        feature.properties['addr:postcode']
      ].join('/')

      if (!(key in nonRangesByStreet)) {
        nonRangesByStreet[key] = []
      }
      nonRangesByStreet[key].push(feature)
    }

    callback()
  }
})

const regexp = /^(?<pre>\D*)(?<num>\d*)(?<suf>\D*)$/

/*
* second pass, filter A removes ranges where each endpoint of the range exists separately
* eg.
*  - 304-306 Cardigan Street Carlton - range can be removed since each individual address exists
*  - 304 Cardigan Street Calton
*  - 306 Cardigan Street Calton
* 
*  - 249-263 Faraday Street
*  - 251 Faraday Street - removed since not all addresses from the range exist, but this one is covered by the range
*/
let reduceRangeIndex = 0
const reduceRange = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    reduceRangeIndex++
    if (process.stdout.isTTY && reduceRangeIndex % 10000 === 0) {
      process.stdout.write(` ${reduceRangeIndex / 1000}k / ${Math.round(sourceCount / 1000)}k (${Math.round(reduceRangeIndex / sourceCount * 100)}%)\r`)
    }
    
    const isRange = feature.properties['addr:housenumber'].split('-').length > 1
    if (isRange) {
      // see if it can be removed when each end point of the range is included separately
      const start = feature.properties['addr:housenumber'].split('-')[0]
      const end = feature.properties['addr:housenumber'].split('-')[1]

      const key = [
        feature.properties['addr:street'],
        feature.properties['addr:suburb'],
        feature.properties['addr:state'],
        feature.properties['addr:postcode']
      ].join('/')

      // find nonRange addresses on the same street
      if (key in nonRangesByStreet) {
        const matchCandidates = nonRangesByStreet[key]

        let foundStart = false
        let foundEnd = false

        let startNum
        let endNum
        let pre = ''
        let suf = ''

        for (const matchCandidate of matchCandidates) {
          if (!foundStart && start === matchCandidate.properties['addr:housenumber']) {
            foundStart = true

            const match = start.match(regexp)
            startNum = match.groups.num
            pre = match.groups.pre
            suf = match.groups.suf
          }
          if (!foundEnd && end === matchCandidate.properties['addr:housenumber']) {
            foundEnd = true

            const match = end.match(regexp)
            endNum = match.groups.num
          }

          if (foundStart && foundEnd) {
            // stop early
            break
          }
        }

        if (foundStart && foundEnd) {
          // found both start and end

          // see if any intermediates are missing
          const foundAllIntermediates = true
          for (let i = (startNum + 2); i <= (endNum - 2) && foundAllIntermediates === true; i += 2) {
            let foundIntermediate = false
            matchCandidates.map(matchCandidate => {
              if (`${pre}${i}${suf}` === matchCandidate.properties['addr:housenumber']) {
                foundIntermediate = true
              }
            })

            if (foundIntermediate === false) {
              foundAllIntermediates = false
            }
          }
          if (!foundAllIntermediates) {
            // some intermediates were missing
            // but we'll pretend that's okay and let the geocoding algorithm use it's own interpolation to still find results
            if (argv.verbose) {
              console.log('Filter A: Found endpoints but some intermediates are missing', feature)
            }
          }

          // can be removed, feature not pushed
          if (argv.verbose) {
            console.log(`Filter A: ${feature.properties['addr:housenumber']} can be removed`)
          }

          // keep track of removed features for filter B, so we don't double remove both range and midpoints
          rangesRemovedInFilterA[hash(feature)] = true
        } else {
          // since not both start and end found, then still include the range
          this.push(feature)
        }
      } else {
        // there are no non-ranges on this street so still include the range
        this.push(feature)
      }
    } else {
      // else, not a range, we will see if it can be removed in a second pass
      // shall be removed removed when this non-range exists within a range, but the range wasn't removed already
      this.push(feature)
    }

    callback()
  }
})

/*
* Second pass, filter B removes any non-range elements where the range exists, and wasn't removed from the first pass
* eg.
*  - 249-263 Faraday Street
*  - 251 Faraday Street - removed since not all addresses from the range exist, but this one is covered by the range
*/
let reduceNonRangeIndex = 0
const reduceNonRange = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    reduceNonRangeIndex++
    if (process.stdout.isTTY && reduceNonRangeIndex % 10000 === 0) {
      process.stdout.write(` ${reduceNonRangeIndex / 1000}k / ${Math.round(sourceCount / 1000)}k (${Math.round(reduceNonRangeIndex / sourceCount * 100)}%)\r`)
    }
    
    const isRange = feature.properties['addr:housenumber'].split('-').length > 1

    if (!isRange) {
      // not a range, shall be removed where this non-range exists within a range, but the range wasn't removed already
      let dropFeature = false
      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i]
        // if the range wasn't just removed in filter A, and the feature is within the range
        if (!(hash(range) in rangesRemovedInFilterA) && withinRange(feature, range)) {
          // found within a range, drop feature unless would drop addr:unit or addr:flats information
          if ('addr:unit' in feature.properties || 'addr:flats' in feature.properties) {
            // safe to drop if the same addr:unit and addr:flats is also on the range
            if (
              'addr:unit' in feature.properties ? ('addr:unit' in range.properties && feature.properties['addr:unit'] === range.properties['addr:unit']) : true &&
              'addr:flats' in feature.properties ? ('addr:flats' in range.properties && feature.properties['addr:flats'] === range.properties['addr:flats']) : true
              ) {
                dropFeature = true
              } else {
                // since the non-range feature has a unit that the range doesn't have, don't drop it
                dropFeature = false
                if (argv.debug) {
                  debugStreams['addrInRangeDifferentUnits'].write(feature)
                  debugStreams['addrInRangeDifferentUnits'].write(range)
                }
              }
          } else {
            // no addr:unit on the feature to safe to drop
            dropFeature = true
          }
          break
        }
      }
      if (!dropFeature) {
        this.push(feature)
      } else {
        if (argv.verbose) {
          console.log(`Filter B: Dropping ${feature.properties['addr:housenumber']}`)
        }
      }
    } else {
      this.push(feature)
    }

    callback()
  }
})

// ndjson streams to output debug features
const debugKeys = ['addrInRangeDifferentUnits']
const debugStreams = {}
const debugStreamOutputs = {}

if (argv.debug) {
  debugKeys.forEach(key => {
    debugStreams[key] = ndjson.stringify()
    debugStreamOutputs[key] = debugStreams[key].pipe(fs.createWriteStream(`debug/reduceRangeDuplicates/${key}.geojson`))
  })
}

// first pass to index by geometry
console.log('First pass to index non-ranges by street,suburb,state,postcode properties')
pipeline(
  fs.createReadStream(inputFile),
  ndjson.parse(),
  index,
  err => {
    if (err) {
      console.log(err)
      process.exit(1)
    } else {
      console.log('Second pass to remove range duplicates')
      // second pass to remove range duplicates
      pipeline(
        fs.createReadStream(inputFile),
        ndjson.parse(),
        reduceRange,
        reduceNonRange,
        ndjson.stringify(),
        fs.createWriteStream(outputFile),
        err => {
          if (err) {
            console.log(err)
            process.exit(1)
          } else {
            if (argv.debug) {
              debugKeys.forEach(key => {
                debugStreams[key].end()
              })

              Promise.all(debugKeys.map(key => {
                return new Promise(resolve => {
                  debugStreamOutputs[key].on('finish', () => {
                    console.log(`saved debug/reduceRangeDuplicates/${key}.geojson`)
                    resolve()
                  })
                })
              }))
                .then(() => {
                  process.exit(0)
                })
            } else {
              process.exit(0)
            }
          }
        }
      )
    }
  }
)
