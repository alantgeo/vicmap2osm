#!/usr/bin/env node

const fs = require('fs')
const { Readable, Transform, pipeline } = require('stream')
const ndjson = require('ndjson')

const args = process.argv.slice(2)

if (args.length < 2) {
  console.error("Usage: ./reduceOverlap.js input.geojson output.geojson")
  process.exit(1)
}

const inputFile = args[0]
const outputFile = args[1]

if (!fs.existsSync(inputFile)) {
  console.error(`${inputFile} not found`)
  process.exit(1)
}

let sourceCount = 0
const features = {}

const index = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    sourceCount++

    const geometryKey = feature.geometry.coordinates.join(',')

    if (!(geometryKey in features)) {
      features[geometryKey] = []
    }
    features[geometryKey].push(feature)

    callback()
  }
})

const reduce = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(key, encoding, callback) {

    var groupedFeatures = features[key]
    if (groupedFeatures.length === 1) {
      this.push(groupedFeatures[0])
    } else {
      // reduce

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
          } else {
            const nonUnitFeature = nonUnitFeatures[0]

            // place all the other addr:unit into addr:flats
            const allOtherUnits = groupedFeatures.filter(f => 'addr:unit' in f.properties).map(f => f.properties['addr:unit'])

            // if allOtherUnits.length is one then that means we have one address without a unit and one with a unit at the same point
            // TODO should we just drop the non-unit address and keep the addr:unit one?

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

            // todo sort numeric
            nonUnitFeature.properties['addr:flats'] = sortedAllOtherUnitsAsRanges.join(';')
            this.push(nonUnitFeature)
          }
        } else {
          // all have same housenumber, street, suburb, state, postcode but no non-unit
          // combine all the addr:unit into addr:flats and then drop addr:unit
          const units = groupedFeatures.filter(f => 'addr:unit' in f.properties).map(f => f.properties['addr:unit'])

          // TODO assert units.length > 1

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

          // todo sort numeric
          feature.properties['addr:flats'] = unitRanges.join(';')
          this.push(feature)
        }
      } else {
        console.log('addresses with the same geometry, however more than unit differs')
        // TODO need to investigate to see what we can/shoud do about these
        //console.log(groupedFeatures)
        for (let i = 0; i < groupedFeatures.length; i++) {
          this.push(groupedFeatures[i])
        }
      }
    }

    callback()
  }
})

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
            process.exit(0)
          }
        }
      )
    }
  }
)
