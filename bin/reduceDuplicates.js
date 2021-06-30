#!/usr/bin/env node

/**
 * Remove duplicates (exact tags) at the same location or within a small proximity.
 */

const fs = require('fs')
const { Readable, Transform, pipeline } = require('stream')
const ndjson = require('ndjson')
const cluster = require('../lib/cluster.js')
const cloneDeep = require('clone-deep')
const xml = require('xml-js')
const _ = require('lodash')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .option('debug', {
    type: 'boolean',
    description: 'Dumps full debug logs'
  })
  .argv

if (argv._.length < 2) {
  console.error("Usage: ./reduceDuplicates.js input.geojson output.geojson")
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

// index features by properties
const index = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(feature, encoding, callback) {
    sourceCount++

    if (process.stdout.isTTY && sourceCount % 10000 === 0) {
      process.stdout.write(` ${sourceCount.toLocaleString()}\r`)
    }

    const key = [
      feature.properties['addr:unit'],
      feature.properties['addr:housenumber'],
      feature.properties['addr:street'],
      feature.properties['addr:suburb'],
      feature.properties['addr:state'],
      feature.properties['addr:postcode']
    ].join('/')

    if (!(key in features)) {
      features[key] = []
    }
    features[key].push(feature)

    callback()
  }
})

// remove duplicates
let reduceIndex = 0
const reduce = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(key, encoding, callback) {
    reduceIndex++
    if (process.stdout.isTTY && reduceIndex % 10000 === 0) {
      process.stdout.write(` ${reduceIndex.toLocaleString()} / ${sourceCount.toLocaleString()} (${Math.round(reduceIndex / sourceCount * 100)}%)\r`)
    }

    // groupedFeatures is a list of features which all shared the same attributes, these may or may not share the same geometry
    const groupedFeatures = features[key]
    if (groupedFeatures.length === 1) {
      // address not duplicated, pass through as unique

      this.push(groupedFeatures[0])
    } else {
      // address appears multiple times

      const sameCoordinates = [...new Set(groupedFeatures.map(f => f.geometry.coordinates.join(',')))].length <= 1
      if (sameCoordinates) {
        // features have same properties and same geometry, so they are true duplicates which can safely be reduced to one
        this.push(groupedFeatures[0])
        if (argv.debug) {
          for (const feature of groupedFeatures.slice(1)) {
            debugStreams.droppedSameCoordinates.write(feature)
          }
        }
      } else {
        // features have same properties but not all with the same geometry

        // cluster features with a threshold of 25m
        const clusters = cluster(groupedFeatures, 25)

        // if clustered into a single cluster, then output a single average feature
        // this should be safe to use as within 25m
        if (clusters.length === 1) {
          const averageCoordinates = [
            groupedFeatures.map(f => f.geometry.coordinates[0]).reduce((acc, cur) => acc + cur) / groupedFeatures.length,
            groupedFeatures.map(f => f.geometry.coordinates[1]).reduce((acc, cur) => acc + cur) / groupedFeatures.length
          ]
          const averageFeature = cloneDeep(groupedFeatures[0])
          if (averageFeature.properties._pfi) {
            averageFeature.properties._pfi = groupedFeatures.map(f => f.properties._pfi).join(',')
          }
          averageFeature.geometry.coordinates = averageCoordinates

          if (argv.debug) {
            // create a spider web to illustrate which features were clustered together and where the average point is
            const spiderWebCoordinates = []

            debugStreams.singleCluster.write(averageFeature)
            groupedFeatures.forEach(feature => {
              // debugStreams.singleCluster.write(feature)

              // start with the average point
              spiderWebCoordinates.push(averageFeature.geometry.coordinates)
              // go out to the source point
              spiderWebCoordinates.push(feature.geometry.coordinates)
              // end back at the average point
              spiderWebCoordinates.push(averageFeature.geometry.coordinates)
            })

            // output a web connecting the source points for visualisation
            debugStreams.singleCluster.write({
              type: 'Feature',
              properties: Object.assign({ '_type': 'Single Cluster' }, averageFeature.properties),
              geometry: {
                type: 'LineString',
                coordinates: spiderWebCoordinates
              }
            })
          }

          this.push(averageFeature)
        } else {
          // more than one cluster, reduce those clustered into centroids, and then report all the centroids
          // these will need to be manually reviewed
          const clusterAverages = clusters.map(cluster => {
            if (cluster.length === 1) {
              return cluster[0]
            } else {
              const averageCoordinates = [
                cluster.map(f => f.geometry.coordinates[0]).reduce((acc, cur) => acc + cur) / cluster.length,
                cluster.map(f => f.geometry.coordinates[1]).reduce((acc, cur) => acc + cur) / cluster.length
              ]
              const averageFeature = cloneDeep(cluster[0])
              if (averageFeature.properties._pfi) {
                averageFeature.properties._pfi = groupedFeatures.map(f => f.properties._pfi).join(',')
              }
              averageFeature.geometry.coordinates = averageCoordinates
              return averageFeature
            }
          })

          // report these as address points with the same attributes but different locations beyond the cluster threshold
          if (argv.debug) {
            const webOfMatches = {
              type: 'Feature',
              properties: Object.assign(
                { '_type': 'Multi Cluster' },
                clusterAverages[0].properties,
                clusterAverages[0].properties._pfi ? { _pfi: clusterAverages.map(f => f.properties._pfi).join(',')} : {}
              ),
              geometry: {
                type: 'LineString',
                coordinates: clusterAverages.map(p => p.geometry.coordinates)
              }
            }
            clusterAverages.forEach(feature => {
              // output candidate feature
              debugStreams.multiCluster.write(feature)
            })
            // output a web connecting the candidates for visualisation
            debugStreams.multiCluster.write(webOfMatches)

            // output as a MapRoulette task
            const task = {
              type: 'FeatureCollection',
              features: [
                ...groupedFeatures
              ],
              cooperativeWork: {
                meta: {
                  version: 2,
                  type: 2
                },
                file: {
                  type: 'xml',
                  format: 'osc',
                  encoding: 'base64',
                  content: Buffer.from(featureToOsc(groupedFeatures[0])).toString('base64') // the base64-encoded osc file
                }
              }
            }
            debugStreams.mr_duplicateAddressFarApart.write(task)
          }
        }
      }
    }

    callback()
  }
})

function featureToOsc(feature) {
  return xml.json2xml({
    _declaration: {
      _attributes: {
        version: "1.0",
        encoding: "UTF-8"
      }
    },
    osmChange: {
      _attributes: {
        version: '0.6',
        generator: 'alantgeo/vicmap2osm'
      },
      create: {
        node: {
          _attributes: {
            id: -1,
            version: 1,
            lat: feature.geometry.coordinates[1],
            lon: feature.geometry.coordinates[0]
          },
          tag: Object.keys(_.omit(feature.properties, ['_pfi'])).map(key => {
            return {
              _attributes: {
                k: key,
                v: feature.properties[key]
              }
            }
          })
        }
      }
    }
  }, Object.assign({
    compact: true,
    attributeValueFn: value => {
      // these values were tested with test/xmlEntities.js
      return value.replace(/&quot;/g, '"')  // convert quote back before converting amp
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    }
  }, argv.dryRun ? { spaces: 2 } : {}))
}

// ndjson streams to output debug features
const debugKeys = ['singleCluster', 'multiCluster', 'droppedSameCoordinates', 'mr_duplicateAddressFarApart']
const debugStreams = {}
const debugStreamOutputs = {}

if (argv.debug) {
  debugKeys.forEach(key => {
    debugStreams[key] = ndjson.stringify()
    debugStreamOutputs[key] = debugStreams[key].pipe(fs.createWriteStream(`debug/reduceDuplicates/${key}.geojson`))
  })
}

// first pass to index by geometry
console.log('Pass 1/2: index by address properties')
pipeline(
  fs.createReadStream(inputFile),
  ndjson.parse(),
  index,
  err => {
    if (err) {
      console.log(err)
      process.exit(1)
    } else {
      console.log(`  of ${sourceCount.toLocaleString()} features found ${Object.keys(features).length.toLocaleString()} unique addresses`)
      // second pass to reduce duplicate features
      console.log('Pass 2/2: reduce duplicate features')
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
            if (argv.debug) {
              debugKeys.forEach(key => {
                debugStreams[key].end()
              })

              Promise.all(debugKeys.map(key => {
                return new Promise(resolve => {
                  debugStreamOutputs[key].on('finish', () => {
                    console.log(`saved debug/reduceDuplicates/${key}.geojson`)
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
