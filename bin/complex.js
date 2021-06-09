#!/usr/bin/env node

/**
 * Take Vicmap address points which have a complex value, and group these into sites,
 * then conflate with existing OSM names
 */

const fs = require('fs')
const { Transform, pipeline } = require('readable-stream')
const ndjson = require('ndjson')
const convex = require('@turf/convex').default
const featureCollection = require('@turf/helpers').featureCollection
const point = require('@turf/helpers').point
const multiPoint = require('@turf/helpers').multiPoint
const geometryCollection = require('@turf/helpers').geometryCollection
const { capitalCase } = require('capital-case')
const Flatbush = require('flatbush')
const bbox = require('@turf/bbox').default
const { around } = require('geoflatbush')
const { lcs } = require('string-comparison')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .argv

if (argv._.length < 3) {
  console.error("Usage: ./complex.js vicmap-complex.geojson victoria-named-features.osm.geojson vicmap-complex-site")
  process.exit(1)
}

const inputFile = argv._[0]
const osmFile = argv._[1]
const outputPath = argv._[2]

if (!fs.existsSync(inputFile)) {
  console.error(`${inputFile} not found`)
  process.exit(1)
}

console.log('Reading OSM data')
const osmFeatures = fs.readFileSync(osmFile, 'utf-8').toString().split('\n')
  .filter(line => line !== '')
  .map((line, index, array) => {
    if (process.stdout.isTTY && index % 1000 === 0) {
      process.stdout.write(` ${index.toLocaleString()}/${array.length.toLocaleString()} (${Math.round(index / array.length * 100)}%)\r`)
    }

    try {
      const feature = JSON.parse(line)
      feature.properties.id = index
      return feature
    } catch {
      console.log(`Error parsing line ${index} of ${osmFile}: ${line}`)
    }
  })

console.log('Creating index for nearby OSM search')
const osmIndex = new Flatbush(osmFeatures.length)
for (const osmFeature of osmFeatures) {
  osmIndex.add(...bbox(osmFeature))
}
osmIndex.finish()

// ndjson streams to output features
const outputKeys = [
  // contains multipoint, centroid and hull in one feature
  'geometryCollection',

  // because some software (cough cough QGIS) can't handle GeometryCollections, output each geometry type as it's own file
  'multiPoint',
  'centroid',
  'hull',

  // MapRoulette challenges
  'mr_singleNearbySimilarFeature',
  'mr_multipleNearbySimilarFeatures',
  'mr_noNearbySimilarFeature'
]
const outputStreams = {}
const outputStreamOutputs = {}

outputKeys.forEach(key => {
  outputStreams[key] = ndjson.stringify()
  outputStreamOutputs[key] = outputStreams[key].pipe(fs.createWriteStream(`${outputPath}/${key}.geojson`))
})

const complexes = {}

let sourceCount = 0
const group = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    sourceCount++

    if (!argv.quiet) {
      if (process.stdout.isTTY && sourceCount % 10000 === 0) {
        process.stdout.write(` ${sourceCount.toLocaleString()}\r`)
      }
    }

    const name = feature.properties.name
    if (!(name in complexes)) {
      complexes[name] = []
    }

    complexes[name].push(feature)

    callback()
  }
})

console.log('Stage 1/2 reading Vicmap complex points into groups')
pipeline(
  fs.createReadStream(inputFile),
  ndjson.parse(),
  group,
  (err) => {
    if (err) {
      console.log(err)
      process.exit(1)
    } else {

      console.log('Stage 2/2 saving features per complex')
      // output complexes as a geometry collection feature with a hull and multipoint
      let complexIndex = 0
      for (const [name, complex] of Object.entries(complexes)) {
        complexIndex++
        if (process.stdout.isTTY && complexIndex % 50 === 0) {
          process.stdout.write(` ${complexIndex.toLocaleString()}/${Object.keys(complexes).length.toLocaleString()} (${Math.round(complexIndex / Object.keys(complexes).length * 100)}%)\r`)
        }

        const properties = {
          name: capitalCase(name)
        }

        const points = multiPoint(complex.map(feature => feature.geometry.coordinates), properties)
        const hull = convex(featureCollection(complex), { properties })
        const centroid = point(
          points.geometry.coordinates
            .reduce((acc, cur) => {
              return [
                acc[0] + cur[0],
                acc[1] + cur[1]
              ]
            }, [0, 0])
            .map(v => v / points.geometry.coordinates.length)
        , properties)

        outputStreams.multiPoint.write(points)
        outputStreams.centroid.write(centroid)
        outputStreams.hull.write(hull ? hull : point(complex[0].geometry.coordinates, properties))

        // GeometryCollection feature of MultiPoints plus either the convex hull polygon or single point if the hull is just a single point
        const feature = geometryCollection([points.geometry, hull ? hull.geometry : complex[0].geometry], properties)

        outputStreams.geometryCollection.write(feature)

        // find nearby matching OSM feature
        const maxDistanceInKm = 1
        const nearby = around(osmIndex, ...centroid.geometry.coordinates, Infinity, maxDistanceInKm)
        const nearbyMatches = nearby.filter(i => {
          const similarity = lcs.similarity(osmFeatures[i].properties.name.toLowerCase(), name.toLowerCase())
          return similarity > 0.7
        })
        const nearbyMatchedFeatures = nearbyMatches.map(i => osmFeatures[i])

        if (nearbyMatches.length) {
          console.log(name)
          console.log(' > ', nearbyMatches.map(i => osmFeatures[i].properties.name))
        }
        if (nearbyMatches.length === 1) {
          // a single nearby OSM features found with similar name
          if (nearbyMatchedFeatures[0].properties.name.toLowerCase === name.toLowerCase()) {
            // name exactly matched
            console.log(`Exact match: ${properties.name} = ${nearbyMatchedFeatures[0].properties.name}`)
          } else {
            // name was similar but not an exact match
            // create a MapRoulette task to investigate further
            const task = {
              type: 'FeatureCollection',
              features: [
                ...complex.map(feature => {
                  feature.properties['marker-color'] = 'orange'
                  feature.properties['marker-color'] = 'small'
                  return feature
                }),
                point(centroid.geometry.coordinates, Object.assign({}, centroid.properties, {
                  'marker-color': 'orange',
                  'marker-size': 'large',
                  'OSM Name': nearbyMatchedFeatures[0].properties.name
                })),
                ...nearbyMatchedFeatures
              ]
            }
            outputStreams.mr_singleNearbySimilarFeature.write(task)
          }
        } else if (nearbyMatches.length > 1) {
          // multiple nearby OSM features found with similar name, create a MapRoulette task to investigate further
          const task = {
            type: 'FeatureCollection',
            features: [
              ...complex.map(feature => {
                feature.properties['marker-color'] = 'orange'
                feature.properties['marker-color'] = 'small'
                return feature
              }),
              point(centroid.geometry.coordinates, Object.assign({}, centroid.properties, {
                'marker-color': 'orange',
                'marker-size': 'large'
              })),
              ...nearbyMatchedFeatures
            ]
          }
          outputStreams.mr_multipleNearbySimilarFeatures.write(task)
        } else {
          // no nearby OSM feature found with similar name, so create a MapRoulette task
          const task = {
            type: 'FeatureCollection',
            features: [ centroid ]
          }
          outputStreams.mr_noNearbySimilarFeature.write(task)
        }
      }

      outputKeys.forEach(key => {
        outputStreams[key].end()
      })

      Promise.all(outputKeys.map(key => {
        return new Promise(resolve => {
          outputStreamOutputs[key].on('finish', () => {
            console.log(`saved ${outputPath}/${key}.geojson`)
            resolve()
          })
        })
      }))
        .then(() => {
          process.exit(0)
        })
    }
  }
)
