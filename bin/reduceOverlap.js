#!/usr/bin/env node

const fs = require('fs')
const { Readable, Transform, pipeline } = require('stream')
const ndjson = require('ndjson')
const cloneDeep = require('clone-deep')
const unitsToRanges = require('../lib/unitsToRanges.js')
const valueLimits = require('../lib/valueLimits.js')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .option('debug', {
    type: 'boolean',
    description: 'Dumps full debug logs'
  })
  .option('verbose', {
    type: 'boolean',
    description: ''
  })
  .argv

if (argv._.length < 2) {
  console.error("Usage: ./reduceOverlap.js input.geojson output.geojson")
  process.exit(1)
}

const inputFile = argv._[0]
const outputFile = argv._[1]

if (!fs.existsSync(inputFile)) {
  console.error(`${inputFile} not found`)
  process.exit(1)
}

let sourceCount = 0
const features = {}

/**
 * Index features by geometry. Used as a first pass, so a second pass can easily compare
 * features with the same geometry.
 */
const index = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    sourceCount++

    if (!argv.quiet) {
      if (process.stdout.isTTY && sourceCount % 10000 === 0) {
        process.stdout.write(` ${sourceCount.toLocaleString()}\r`)
      }
    }

    const geometryKey = feature.geometry.coordinates.join(',')

    if (!(geometryKey in features)) {
      features[geometryKey] = []
    }
    features[geometryKey].push(feature)

    callback()
  }
})

/**
 * Reduces features with the same geometry.
 */
let reduceIndex = 0
const reduce = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(key, encoding, callback) {
    reduceIndex++
    if (!argv.quiet) {
      if (process.stdout.isTTY && reduceIndex % 10000 === 0) {
        process.stdout.write(` ${reduceIndex.toLocaleString()} / ${sourceCount.toLocaleString()} (${Math.round(reduceIndex / sourceCount * 100)}%)\r`)
      }
    }

    var groupedFeatures = features[key]

    if (groupedFeatures.length === 1) {
      // only one feature with this geometry, nothing to reduce, output as is
      this.push(groupedFeatures[0])
    } else {
      // mulitple features with the same geometry

      // group by housenumber, street, suburb, state, postcode to reduce units into addr:flats
      // groupedFeatures all all the features at the same point
      const featuresGroupByNonUnit = {}
      groupedFeatures.forEach(feature => {
        const key = [
          feature.properties['addr:housenumber'],
          feature.properties['addr:street'],
          feature.properties['addr:suburb'],
          feature.properties['addr:state'],
          feature.properties['addr:postcode']
        ].join(';')

        if (!(key in featuresGroupByNonUnit)) {
          featuresGroupByNonUnit[key] = []
        }

        featuresGroupByNonUnit[key].push(feature)
      })

      Object.values(featuresGroupByNonUnit).forEach(featureGroup => {
        if (featureGroup.length > 1) {
          const hasNonUnit = featureGroup.map(f => 'addr:unit' in f.properties).includes(false)

          if (hasNonUnit) {
            // all have same housenumber, street, suburb, state, postcode and there is a non-unit feature
            const nonUnitFeatures = featureGroup.filter(f => (!('addr:unit' in f.properties)))
            if (nonUnitFeatures.length > 1) {
              // multiple non-unit features, unsure how to reduce
              // TODO should these still be output to be picked up by ranges
              if (argv.debug) {
                featureGroup.forEach(feature => {
                  debugStreams.multipleNonUnit.write(feature)
                })
              }
            } else {
              // a single non-unit feature exists
              const nonUnitFeature = cloneDeep(nonUnitFeatures[0])

              // place all the other addr:unit into addr:flats on the non-unit feature
              const allOtherUnits = featureGroup.filter(f => 'addr:unit' in f.properties).map(f => f.properties['addr:unit'])

              // if allOtherUnits.length is one then that means we have one address without a unit and one with a unit at the same point
              // in this case we just drop the non-unit address and keep the addr:unit one
              if (allOtherUnits.length === 1) {
                if (argv.debug) {
                  featureGroup.forEach(feature => {
                    debugStreams.oneUnitOneNonUnit.write(feature)
                  })
                }
                this.push(featureGroup.filter(f => 'addr:unit' in f.properties)[0])
              } else {
                const flats = unitsToRanges(allOtherUnits, argv.verbose && featureGroup)
                nonUnitFeature.properties['addr:flats'] = flats
                this.push(nonUnitFeature)
              }
            }
          } else {
            // all have same housenumber, street, suburb, state, postcode but no non-unit, ie. all with different unit values
            // combine all the addr:unit into addr:flats and then drop addr:unit
            const units = featureGroup.filter(f => 'addr:unit' in f.properties).map(f => f.properties['addr:unit'])

            if (units.length <= 1) {
              console.log(`all have same housenumber, street, suburb, state, postcode with no non-unit, but only found ${units.length} units`, units)
              process.exit(1)
            }

            const feature = cloneDeep(featureGroup[0])
            delete feature.properties['addr:unit']

            const flats = unitsToRanges(units, argv.verbose && featureGroup)
            feature.properties['addr:flats'] = flats
            this.push(feature)
          }
        } else if (featureGroup.length === 1) {
          // while other features share the same geometry, this one is unique in it's housenumber,street,suburb,state,postcode
          // so output this feature, and we deal with the overlap at another stage
          const feature = featureGroup[0]
          this.push(feature)

          if (argv.debug) {
            debugStreams.sameGeometry.write(feature)
          }
        }
      })
    }

    callback()
  }
})

/**
 * limit values
 */
let limitValuesIndex = 0
const limitValues = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    limitValuesIndex++
    if (!argv.quiet) {
      if (limitValuesIndex % 10000 === 0) {
        process.stdout.write(` ${limitValuesIndex.toLocaleString()} / ${sourceCount.toLocaleString()} (${Math.round(limitValuesIndex / sourceCount * 100)}%)\r`)
      }
    }
    this.push(valueLimits(feature))

    callback()
  }
})

const debugKeys = ['multipleNonUnit', 'oneUnitOneNonUnit', 'sameGeometry']
const debugStreams = {}
const debugStreamOutputs = {}

if (argv.debug) {
  debugKeys.forEach(key => {
    debugStreams[key] = ndjson.stringify()
    debugStreamOutputs[key] = debugStreams[key].pipe(fs.createWriteStream(`debug/reduceOverlap/${key}.geojson`))
  })
}

// first pass to index by geometry
console.log('Pass 1/2: index by geometry')
pipeline(
  fs.createReadStream(inputFile),
  ndjson.parse(),
  index,
  err => {
    if (err) {
      console.log(err)
      process.exit(1)
    } else {
      console.log(`  of ${sourceCount.toLocaleString()} features found ${Object.keys(features).length.toLocaleString()} unique geometries`)
      // second pass to reduce overlapping features
      console.log('Pass 2/2: reduce overlapping features')
      pipeline(
        Readable.from(Object.keys(features)),
        reduce,
        limitValues,
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
                    console.log(`saved debug/reduceOverlap/${key}.geojson`)
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
