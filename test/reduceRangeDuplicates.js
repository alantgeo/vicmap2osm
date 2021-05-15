const test = require('tape')
const fs = require('fs')
const child_process = require('child_process')
const mktemp = require('mktemp')

function createFeature(housenumber, street, suburb) {
  return {
    type: 'Feature',
    properties: {
      'addr:housenumber': housenumber,
      'addr:street': street,
      'addr:suburb': suburb,
      'addr:state': 'VIC',
      'addr:postcode': '0000'
    },
    geometry: null
  }
}

test('reduceRangeDuplicates', t => {
  const inputFile = mktemp.createFileSync('/tmp/input_XXXXX.geojson')
  const outputFile = mktemp.createFileSync('/tmp/output_XXXXX.geojson')
  const expectedFile = mktemp.createFileSync('/tmp/expected_XXXXX.geojson')

  const AB = createFeature('304-306', 'Cardigan Street', 'Carlton')
  const A = createFeature('304', 'Cardigan Street', 'Carlton')
  const B = createFeature('306', 'Cardigan Street', 'Carlton')

  // all three features to appear in input
  fs.appendFileSync(inputFile, JSON.stringify(AB) + '\n')
  fs.appendFileSync(inputFile, JSON.stringify(A) + '\n')
  fs.appendFileSync(inputFile, JSON.stringify(B) + '\n')

  // output expected to just be endpoints, dropping the range
  fs.appendFileSync(expectedFile, JSON.stringify(A) + '\n')
  fs.appendFileSync(expectedFile, JSON.stringify(B) + '\n')

  child_process.execSync(`./bin/reduceRangeDuplicates.js ${inputFile} ${outputFile}`)

  t.same(
    fs.readFileSync(outputFile),
    fs.readFileSync(expectedFile),
    'range with endpoints appearing separately, drops range'
  )

  fs.unlinkSync(inputFile)
  fs.unlinkSync(outputFile)
  fs.unlinkSync(expectedFile)

  t.end()
})

test('reduceRangeDuplicates', t => {
  const inputFile = mktemp.createFileSync('/tmp/input_XXXXX.geojson')
  const outputFile = mktemp.createFileSync('/tmp/output_XXXXX.geojson')
  const expectedFile = mktemp.createFileSync('/tmp/expected_XXXXX.geojson')

  const AC = createFeature('249-263', 'Faraday Street', 'Carlton')
  const B = createFeature('251', 'Faraday Street', 'Carlton')

  // both features to appear in input
  fs.appendFileSync(inputFile, JSON.stringify(AC) + '\n')
  fs.appendFileSync(inputFile, JSON.stringify(B) + '\n')

  // output expected to just be range, dropping the midpoint
  fs.appendFileSync(expectedFile, JSON.stringify(AC) + '\n')

  child_process.execSync(`./bin/reduceRangeDuplicates.js ${inputFile} ${outputFile}`)

  t.same(
    fs.readFileSync(outputFile),
    fs.readFileSync(expectedFile),
    'range with lone midpoint, drops midpoint'
  )

  fs.unlinkSync(inputFile)
  fs.unlinkSync(outputFile)
  fs.unlinkSync(expectedFile)

  t.end()
})
