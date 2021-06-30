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

const intermediateFile = `${outputFile}-intermediate.json`

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

const rangesByStreet = {}
const nonRangesByStreet = {}
const rangesRemovedInFilterA = {}

// index all non-range addresses by street, suburb, state, postcode
const index = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    sourceCount++

    if (process.stdout.isTTY && sourceCount % 10000 === 0) {
      process.stdout.write(` ${sourceCount.toLocaleString()}\r`)
    }

    const isRange = feature.properties['addr:housenumber'].split('-').length > 1

    const key = [
      feature.properties['addr:street'],
      feature.properties['addr:suburb'],
      feature.properties['addr:state'],
      feature.properties['addr:postcode']
    ].join('/')
    if (isRange) {
      if (!(key in rangesByStreet)) {
        rangesByStreet[key] = []
      }
      rangesByStreet[key].push(feature)
    } else {
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
* First pass, filter A removes ranges where each endpoint of the range exists separately
* eg.
*  - 304-306 Cardigan Street Carlton - range can be removed since each individual address exists
*  - 304 Cardigan Street Calton
*  - 306 Cardigan Street Calton
*
*  Conditional on the individual addresses not sharing the same geometry, if they do then they are dropped in favour of the range
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
      process.stdout.write(` ${reduceRangeIndex.toLocaleString()} / ${sourceCount.toLocaleString()} (${Math.round(reduceRangeIndex / sourceCount * 100)}%)\r`)
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

        let matchedStart
        let matchedEnd

        let startNum
        let endNum
        let pre = ''
        let suf = ''

        for (const matchCandidate of matchCandidates) {
          if (!foundStart && start === matchCandidate.properties['addr:housenumber']) {
            foundStart = true
            matchedStart = matchCandidate

            const match = start.match(regexp)
            if (match && match.groups) {
              startNum = match.groups.num
              pre = match.groups.pre
              suf = match.groups.suf
            }
          }
          if (!foundEnd && end === matchCandidate.properties['addr:housenumber']) {
            foundEnd = true
            matchedEnd = matchCandidate

            const match = end.match(regexp)
            if (match && match.groups) {
              endNum = match.groups.num
            }
          }

          if (foundStart && foundEnd) {
            // stop early
            break
          }
        }

        if (foundStart && foundEnd && (!startNum || !endNum)) {
          // found start and end, but couldn't parse out prefix number suffix
          console.log(`Filter A: Found start + end, but couldn't parse out prefix number suffix: ${start} - ${end}`)
        }

        if (foundStart && foundEnd && startNum && endNum) {
          // found both start and end

          // see if any intermediates are missing
          let foundAllIntermediates = true
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

          // if matched start and end point have the same coordinates, then to avoid overlapping points, favour range so retain it
          if (matchedStart.geometry.coordinates.join(',') === (matchedEnd.geometry.coordinates.join(','))) {
            if (argv.verbose) {
              console.log(`Filter A: ${feature.properties['addr:housenumber']} ${feature.properties['addr:street']} ${feature.properties['addr:suburb']} retained because while endpoints exist they share the same geometry`)
            }
            this.push(feature)
          } else {
            // can be removed, feature not pushed
            if (argv.verbose) {
              console.log(`Filter A: ${feature.properties['addr:housenumber']} ${feature.properties['addr:street']} ${feature.properties['addr:suburb']} can be removed`)
            }

            // keep track of removed features for filter B, so we don't double remove both range and midpoints
            rangesRemovedInFilterA[hash(feature)] = true

            if (argv.debug) {
              debugStreams['filterA_dropRange'].write(feature)
            }
          }
        } else {
          // not both start and end found,
          // if one of start or end found and that start/end has addr:flats...
          if (foundStart || foundEnd) {
            // ...if the range has no flats AND the non-range has addr:flats
            if (!feature.properties['addr:flats'] && (
              (matchedStart && matchedStart.properties['addr:flats']) || (matchedEnd && matchedEnd.properties['addr:flats'])
            )) {
              // drop the range, eg "112-116 Anderson Street, South Yarra"
              if (argv.debug) {
                debugStreams['filterA_dropRangeRangeNoFlatsNonRangeHasFlats'].write(feature)
              }
            } else {
              // then still include the range
              this.push(feature)
            }
          } else {
            // then still include the range
            this.push(feature)
          }
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
      process.stdout.write(` ${reduceNonRangeIndex.toLocaleString()} / ${sourceCount.toLocaleString()} (${Math.round(reduceNonRangeIndex / sourceCount * 100)}%)\r`)
    }
    
    const isRange = feature.properties['addr:housenumber'].split('-').length > 1

    if (!isRange) {
      // not a range, shall be removed where this non-range exists within a range, but the range wasn't removed already

      const key = [
        feature.properties['addr:street'],
        feature.properties['addr:suburb'],
        feature.properties['addr:state'],
        feature.properties['addr:postcode']
      ].join('/')

      let dropFeature = false
      let dropReason
      if (key in rangesByStreet) {
        for (let i = 0; i < rangesByStreet[key].length; i++) {
          const range = rangesByStreet[key][i]
          // if the range wasn't just removed in filter A, and the feature is within the range
          if (!(hash(range) in rangesRemovedInFilterA) && withinRange(feature, range, { matchParity: true })) {
            // found within a range, drop feature unless would drop addr:unit or addr:flats information
            if ('addr:unit' in feature.properties || 'addr:flats' in feature.properties) {
              // safe to drop if the same addr:unit and addr:flats is also on the range
              if (
                'addr:unit' in feature.properties ? ('addr:unit' in range.properties && feature.properties['addr:unit'] === range.properties['addr:unit']) : true &&
                'addr:flats' in feature.properties ? ('addr:flats' in range.properties && feature.properties['addr:flats'] === range.properties['addr:flats']) : true
                ) {
                  dropReason = `Dropped due to existing range ${range.properties['addr:housenumber']} ${range.properties['addr:street']} ${range.properties._pfi ? '(' + range.properties._pfi + ')' : ''} where flats and unit match`
                  dropFeature = true
                } else {
                  // since the non-range feature has a unit that the range doesn't have, don't drop it
                  dropFeature = false
                  if (argv.debug) {
                    debugStreams.addrInRangeDifferentUnits.write(feature)
                    debugStreams.addrInRangeDifferentUnits.write(range)

                    debugStreams.addrInRangeDifferentUnits.write({
                      type: 'Feature',
                      properties: feature.properties,
                      geometry: {
                        type: 'LineString',
                        coordinates: [feature.geometry.coordinates, range.geometry.coordinates]
                      }
                    })
                  }
                }
            } else {
              // no addr:unit or addr:flats on the feature to safe to drop
              dropReason = `Dropped due to existing range ${range.properties['addr:housenumber']} ${range.properties['addr:street']} ${range.properties._pfi ? '(' + range.properties._pfi + ')' : ''} without flats or unit to check`
              dropFeature = true
            }
            break
          }
        }
      }

      if (!dropFeature) {
        this.push(feature)
      } else {
        if (argv.verbose) {
          console.log(`Filter B: Dropping ${feature.properties['addr:housenumber']}`)
        }
        if (argv.debug) {
          feature.properties._dropReason = dropReason
          debugStreams['filterB'].write(feature)
        }
      }
    } else {
      this.push(feature)
    }

    callback()
  }
})

// ndjson streams to output debug features
const debugKeys = ['addrInRangeDifferentUnits', 'filterA_dropRangeRangeNoFlatsNonRangeHasFlats', 'filterA_dropRange', 'filterB']
const debugStreams = {}
const debugStreamOutputs = {}

if (argv.debug) {
  debugKeys.forEach(key => {
    debugStreams[key] = ndjson.stringify()
    debugStreamOutputs[key] = debugStreams[key].pipe(fs.createWriteStream(`debug/reduceRangeDuplicates/${key}.geojson`))
  })
}

// first pass to index by geometry
console.log('Pass 1/2: index non-ranges by street,suburb,state,postcode properties')
pipeline(
  fs.createReadStream(inputFile),
  ndjson.parse(),
  index,
  err => {
    if (err) {
      console.log(err)
      process.exit(1)
    } else {
      // second pass to remove range duplicates part A
      console.log('Pass 2/3: remove range duplicates part A ranges')
      pipeline(
        fs.createReadStream(inputFile),
        ndjson.parse(),
        reduceRange,
        ndjson.stringify(),
        fs.createWriteStream(intermediateFile),
        err => {
          if (err) {
            console.log(err)
            process.exit(1)
          } else {
            console.log('Pass 3/3: remove range duplicates part B endpoints')
            pipeline(
              fs.createReadStream(intermediateFile),
              ndjson.parse(),
              reduceNonRange,
              ndjson.stringify(),
              fs.createWriteStream(outputFile),
              err => {
                fs.unlinkSync(intermediateFile)
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
    }
  }
)
