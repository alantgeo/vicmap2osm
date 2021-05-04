#!/usr/bin/env node

const fs = require('fs')
const { Readable, Transform, pipeline } = require('stream')
const ndjson = require('ndjson')
const util = require('util')

const argv = require('yargs/yargs')(process.argv.slice(2)).argv

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
      if (sourceCount % 10000 === 0) {
        process.stdout.write(` ${sourceCount / 1000}k\r`)
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
      if (reduceIndex % 10000 === 0) {
        process.stdout.write(` ${reduceIndex / 1000}k / ${Math.round(sourceCount / 1000)}k (${Math.round(reduceIndex / sourceCount * 100)}%)\r`)
      }
    }

    var groupedFeatures = features[key]

    if (groupedFeatures.length === 1) {
      // only one feature with this geometry, nothing to reduce, output as is
      this.push(groupedFeatures[0])
    } else {
      // mulitple features with the same geometry

      // if housenumber, street, suburb, state, postcode are all the same
      // and it's only unit which differs,
      // and there is an address with no unit
      // then remove all the unit addresses and add them as addr:flats on the no unit address
      const sameHousenumber = [...new Set(groupedFeatures.map(f => f.properties['addr:housenumber']))].length <= 1
      const sameStreet = [...new Set(groupedFeatures.map(f => f.properties['addr:street']))].length <= 1
      const sameSuburb = [...new Set(groupedFeatures.map(f => f.properties['addr:suburb']))].length <= 1
      const sameState = [...new Set(groupedFeatures.map(f => f.properties['addr:state']))].length <= 1
      const samePostcode = [...new Set(groupedFeatures.map(f => f.properties['addr:postcode']))].length <= 1

      const hasNonUnit = groupedFeatures.map(f => 'addr:unit' in f.properties).includes(false)

      if (sameHousenumber && sameStreet && sameSuburb && sameState && samePostcode) {
        if (hasNonUnit) {
          const nonUnitFeatures = groupedFeatures.filter(f => (!('addr:unit' in f.properties)))
          if (nonUnitFeatures.length > 1) {
            // multiple non-unit features, unsure how to reduce
            console.log('multiple non-unit features, unsure how to reduce')
            console.dir(groupedFeatures, {depth: null})
          } else {
            const nonUnitFeature = nonUnitFeatures[0]

            // place all the other addr:unit into addr:flats
            const allOtherUnits = groupedFeatures.filter(f => 'addr:unit' in f.properties).map(f => f.properties['addr:unit'])

            // if allOtherUnits.length is one then that means we have one address without a unit and one with a unit at the same point
            // TODO should we just drop the non-unit address and keep the addr:unit one?
            // need to determine if you always have a non-unit address for the unit address, if there is then
            // perhaps we can safely drop the non-unit address and use a single addr:unit

            // adapted from https://stackoverflow.com/a/54973116/6702659
            const sortedAllOtherUnitsAsRanges = allOtherUnits
              .slice()
              .sort((a, b) => a - b)
              .reduce((acc, cur, idx, src) => {
                if ((idx > 0) && ((cur - src[idx - 1]) === 1)) {
                  acc[acc.length - 1][1] = cur
                } else {
                  acc.push([cur])
                }
                return acc
              }, [])
              .map(range => range.join('-'))

            nonUnitFeature.properties['addr:flats'] = sortedAllOtherUnitsAsRanges.join(';')
            this.push(nonUnitFeature)
          }
        } else {
          // all have same housenumber, street, suburb, state, postcode but no non-unit
          // combine all the addr:unit into addr:flats and then drop addr:unit
          const units = groupedFeatures.filter(f => 'addr:unit' in f.properties).map(f => f.properties['addr:unit'])

          // TODO assert units.length > 1
          if (units.length <= 1) {
            // console.log(`all have same housenumber, street, suburb, state, postcode but no non-unit, but only found ${units.length} units`, units)
          }

          const feature = groupedFeatures[0]
          delete feature.properties['addr:unit']

          // adapted from https://stackoverflow.com/a/54973116/6702659
          const unitRanges = units
            .slice()
            .sort((a, b) => a - b)
            .reduce((acc, cur, idx, src) => {
              if ((idx > 0) && ((cur - src[idx - 1]) === 1)) {
                acc[acc.length - 1][1] = cur
              } else {
                acc.push([cur])
              }
              return acc
            }, [])
            .map(range => range.join('-'))

          feature.properties['addr:flats'] = unitRanges.join(';')
          this.push(feature)
        }
      } else {
        // addresses with the same geometry, however more than unit differs
        // TODO need to investigate to see what we can/shoud do about these
        for (let i = 0; i < groupedFeatures.length; i++) {
          this.push(groupedFeatures[i])
          if (debugSameGeometry) {
            debugSameGeometry.write(groupedFeatures[i])
          }
        }
      }
    }

    callback()
  }
})

const debugSameGeometry = argv.debug ?
  ndjson.stringify()
    .pipe(fs.createWriteStream('debug/reduceOverlap/sameGeometry.geojson'))
  : null

// first pass to index by geometry
console.log('First pass to index by geometry')
pipeline(
  fs.createReadStream(inputFile),
  ndjson.parse(),
  index,
  err => {
    if (err) {
      console.log(err)
      process.exit(1)
    } else {
      console.log(`  of ${sourceCount} features found ${Object.keys(features).length} unique geometries`)
      // second pass to reduce overlapping features
      pipeline(
        Readable.from(Object.keys(features)),
        reduce,
        ndjson.stringify(),
        fs.createWriteStream(outputFile),
        err => {
          if (err) {
            console.log(err)
            process.exit(1)
          } else {
            debugSameGeometry.end()
            process.exit(0)
          }
        }
      )
    }
  }
)
