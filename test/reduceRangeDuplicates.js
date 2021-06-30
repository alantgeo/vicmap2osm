const test = require('tape')
const fs = require('fs')
const child_process = require('child_process')
const mktemp = require('mktemp')

function createFeature(coordinates, unit, housenumber, street, suburb, flats) {
  return {
    type: 'Feature',
    properties: {
      ...(flats && {'addr:flats': flats}),
      ...(unit && {'addr:unit': unit}),
      'addr:housenumber': housenumber,
      'addr:street': street,
      'addr:suburb': suburb,
      'addr:state': 'VIC',
      'addr:postcode': '0000'
    },
    geometry: coordinates ? {
      type: 'Point',
      coordinates: coordinates
    } : null
  }
}

test('reduceRangeDuplicates distinct geometries', t => {
  const inputFile = mktemp.createFileSync('/tmp/input_XXXXX.geojson')
  const outputFile = mktemp.createFileSync('/tmp/output_XXXXX.geojson')
  const expectedFile = mktemp.createFileSync('/tmp/expected_XXXXX.geojson')

  const AB = createFeature([0, 0], null, '304-306', 'Cardigan Street', 'Carlton')
  const A = createFeature([-1, 0], null, '304', 'Cardigan Street', 'Carlton')
  const B = createFeature([1, 0], null, '306', 'Cardigan Street', 'Carlton')

  // all three features to appear in input
  fs.appendFileSync(inputFile, JSON.stringify(AB) + '\n')
  fs.appendFileSync(inputFile, JSON.stringify(A) + '\n')
  fs.appendFileSync(inputFile, JSON.stringify(B) + '\n')

  // output expected to just be endpoints, dropping the range
  fs.appendFileSync(expectedFile, JSON.stringify(A) + '\n')
  fs.appendFileSync(expectedFile, JSON.stringify(B) + '\n')

  child_process.execSync(`./bin/reduceRangeDuplicates.js --verbose ${inputFile} ${outputFile}`)

  t.same(
    fs.readFileSync(outputFile, 'utf-8').trim().split('\n').map(JSON.parse),
    fs.readFileSync(expectedFile, 'utf-8').trim().split('\n').map(JSON.parse),
    'range with endpoints appearing separately, drops range'
  )

  fs.unlinkSync(inputFile)
  fs.unlinkSync(outputFile)
  fs.unlinkSync(expectedFile)

  t.end()
})

test('reduceRangeDuplicates overlapping geometries', t => {
  const inputFile = mktemp.createFileSync('/tmp/input_XXXXX.geojson')
  const outputFile = mktemp.createFileSync('/tmp/output_XXXXX.geojson')
  const expectedFile = mktemp.createFileSync('/tmp/expected_XXXXX.geojson')

  const AB = createFeature([0, 0], null, '304-306', 'Cardigan Street', 'Carlton')
  const A = createFeature([0, 0], null, '304', 'Cardigan Street', 'Carlton')
  const B = createFeature([0, 0], null, '306', 'Cardigan Street', 'Carlton')

  // all three features to appear in input
  fs.appendFileSync(inputFile, JSON.stringify(AB) + '\n')
  fs.appendFileSync(inputFile, JSON.stringify(A) + '\n')
  fs.appendFileSync(inputFile, JSON.stringify(B) + '\n')

  // output expected to drop the endpoints and retain the range since endpoints are overlapping
  fs.appendFileSync(expectedFile, JSON.stringify(AB) + '\n')

  child_process.execSync(`./bin/reduceRangeDuplicates.js --verbose ${inputFile} ${outputFile}`)

  t.same(
    fs.readFileSync(outputFile, 'utf-8').trim().split('\n').map(JSON.parse),
    fs.readFileSync(expectedFile, 'utf-8').trim().split('\n').map(JSON.parse),
    'range with endpoints appearing separately but overlapping, drops the endpoints'
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

  const AC = createFeature(null, null, '249-263', 'Faraday Street', 'Carlton')
  const B = createFeature(null, null, '251', 'Faraday Street', 'Carlton')

  // both features to appear in input
  fs.appendFileSync(inputFile, JSON.stringify(AC) + '\n')
  fs.appendFileSync(inputFile, JSON.stringify(B) + '\n')

  // output expected to just be range, dropping the midpoint
  fs.appendFileSync(expectedFile, JSON.stringify(AC) + '\n')

  child_process.execSync(`./bin/reduceRangeDuplicates.js --verbose ${inputFile} ${outputFile}`)

  t.same(
    fs.readFileSync(outputFile, 'utf-8').trim().split('\n').map(JSON.parse),
    fs.readFileSync(expectedFile, 'utf-8').trim().split('\n').map(JSON.parse),
    'range with lone midpoint, drops midpoint'
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

  const AC = createFeature(null, null, '249-263', 'Faraday Street', 'Carlton')
  const B = createFeature(null, '1', '251', 'Faraday Street', 'Carlton')

  // both features to appear in input
  fs.appendFileSync(inputFile, JSON.stringify(AC) + '\n')
  fs.appendFileSync(inputFile, JSON.stringify(B) + '\n')

  // output expected to both features because dropping the midpoint would loose the unit
  fs.appendFileSync(expectedFile, JSON.stringify(AC) + '\n')
  fs.appendFileSync(expectedFile, JSON.stringify(B) + '\n')

  child_process.execSync(`./bin/reduceRangeDuplicates.js --verbose ${inputFile} ${outputFile}`)

  t.same(
    fs.readFileSync(outputFile, 'utf-8').trim().split('\n').map(JSON.parse),
    fs.readFileSync(expectedFile, 'utf-8').trim().split('\n').map(JSON.parse),
    'midpoint with unit not dropped'
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

  const AC = createFeature(null, null, '249-263', 'Faraday Street', 'Carlton')
  const B = createFeature(null, null, '251', 'Faraday Street', 'Carlton', '1;2;3')

  // both features to appear in input
  fs.appendFileSync(inputFile, JSON.stringify(AC) + '\n')
  fs.appendFileSync(inputFile, JSON.stringify(B) + '\n')

  // output expected to both features because dropping the midpoint would loose the flats
  fs.appendFileSync(expectedFile, JSON.stringify(AC) + '\n')
  fs.appendFileSync(expectedFile, JSON.stringify(B) + '\n')

  child_process.execSync(`./bin/reduceRangeDuplicates.js --verbose ${inputFile} ${outputFile}`)

  t.same(
    fs.readFileSync(outputFile, 'utf-8').trim().split('\n').map(JSON.parse),
    fs.readFileSync(expectedFile, 'utf-8').trim().split('\n').map(JSON.parse),
    'midpoint with flats not dropped'
  )

  fs.unlinkSync(inputFile)
  fs.unlinkSync(outputFile)
  fs.unlinkSync(expectedFile)

  t.end()
})
