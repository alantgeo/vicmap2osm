#!/usr/bin/env node

// There was an issue in the Stage 3 import where some nodes were uploaded with corrupted data.
// This script finds features to be re-imported, bulk in one changeset

const fs = require('fs')
const { Readable, Transform, pipeline } = require('stream')
const ndjson = require('ndjson')
const xml = require('xml-js')
const path = require('path')

const argv = require('yargs/yargs')(process.argv.slice(2))
  .argv

if (argv._.length < 3) {
  console.error("Usage: ./filterReInserts.js locations.txt candidates reInsertFeatures.geojson")
  process.exit(1)
}

const locationsFile = argv._[0]
const candidatesPath = argv._[1]
const reInsertFeaturesFile = argv._[2]

if (!fs.existsSync(locationsFile)) {
  console.error(`${locationsFile} not found`)
  process.exit(1)
}

const locations = fs.readFileSync(locationsFile, { encoding: 'utf8' }).split('\n')
const locationsIndex = {}
for (const location of locations) {
  locationsIndex[location] = true
}

console.log(`Found ${locations.length} locations`)

const candidateFiles = fs.readdirSync(candidatesPath).filter(file => file.endsWith('.geojson'))

let i = 0
const reInsertFeatures = []
for (const candidateFile of candidateFiles) {
  i++
  console.log(`${i}/${candidateFiles.length} ${candidateFile}`)
  const candidates = JSON.parse(fs.readFileSync(path.join(candidatesPath, candidateFile))).features

  for (const candidate of candidates) {
    if (candidate?.geometry?.coordinates.join(',') in locationsIndex) {
      reInsertFeatures.push(candidate)
    }
  }
}
fs.writeFileSync(reInsertFeaturesFile, JSON.stringify({type: "FeatureCollection", features: reInsertFeatures}))
console.log(`${reInsertFeatures.length} features to reinsert: ${reInsertFeaturesFile}`)



