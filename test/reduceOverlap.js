const test = require('tape')
const fs = require('fs')
const child_process = require('child_process')
const mktemp = require('mktemp')

function createFeature(options) {
  return {
    type: 'Feature',
    properties: {
      ...(options.flats && {'addr:flats': options.flats}),
      ...(options.unit && {'addr:unit': options.unit}),
      'addr:housenumber': options.housenumber,
      'addr:street': options.street,
      'addr:suburb': options.suburb,
      'addr:state': 'VIC',
      'addr:postcode': '0000'
    },
    geometry: options.coordinates ? {
      type: 'Point',
      coordinates: options.coordinates
    } : null
  }
}

test('reduceOverlap distinct geometries', t => {
  const inputFile = mktemp.createFileSync('/tmp/input_XXXXX.geojson')
  const outputFile = mktemp.createFileSync('/tmp/output_XXXXX.geojson')
  const expectedFile = mktemp.createFileSync('/tmp/expected_XXXXX.geojson')

  const A = createFeature({
    housenumber: '304',
    street: 'Cardigan Street',
    suburb: 'Carlton',
    coordinates: [0, 0]
  })
  const B = createFeature({
    housenumber: '304',
    street: 'Cardigan Street',
    suburb: 'Carlton',
    coordinates: [1, 1]
  })

  // both features to appear in input
  fs.appendFileSync(inputFile, JSON.stringify(A) + '\n')
  fs.appendFileSync(inputFile, JSON.stringify(B) + '\n')

  // output expected to both inputs since they aren't overlapping
  fs.appendFileSync(expectedFile, JSON.stringify(A) + '\n')
  fs.appendFileSync(expectedFile, JSON.stringify(B) + '\n')

  try {
    child_process.execSync(`./bin/reduceOverlap.js --verbose ${inputFile} ${outputFile}`)
  } catch (err) {
    t.fail(err.stdout.toString())
  }

  t.same(
    fs.readFileSync(outputFile, 'utf-8').trim().split('\n').map(JSON.parse),
    fs.readFileSync(expectedFile, 'utf-8').trim().split('\n').map(JSON.parse),
    'same address at different location is not reduced'
  )

  fs.unlinkSync(inputFile)
  fs.unlinkSync(outputFile)
  fs.unlinkSync(expectedFile)

  t.end()
})

test('reduceOverlap matching geometries different attributes', t => {
  const inputFile = mktemp.createFileSync('/tmp/input_XXXXX.geojson')
  const outputFile = mktemp.createFileSync('/tmp/output_XXXXX.geojson')
  const expectedFile = mktemp.createFileSync('/tmp/expected_XXXXX.geojson')

  const A = createFeature({
    housenumber: '100',
    street: 'Foo Street',
    suburb: 'A',
    coordinates: [0, 0]
  })
  const B = createFeature({
    housenumber: '200',
    street: 'Bar Street',
    suburb: 'B',
    coordinates: [0, 0]
  })

  // both features to appear in input
  fs.appendFileSync(inputFile, JSON.stringify(A) + '\n')
  fs.appendFileSync(inputFile, JSON.stringify(B) + '\n')

  // output expected to retain both inputs
  fs.appendFileSync(expectedFile, JSON.stringify(A) + '\n')
  fs.appendFileSync(expectedFile, JSON.stringify(B) + '\n')

  try {
    child_process.execSync(`./bin/reduceOverlap.js --verbose ${inputFile} ${outputFile}`)
  } catch (err) {
    t.fail(err.stdout.toString())
  }

  t.same(
    fs.readFileSync(outputFile, 'utf-8').trim().split('\n').map(JSON.parse),
    fs.readFileSync(expectedFile, 'utf-8').trim().split('\n').map(JSON.parse),
    'different address at same location is retained'
  )

  fs.unlinkSync(inputFile)
  fs.unlinkSync(outputFile)
  fs.unlinkSync(expectedFile)

  t.end()
})

test('reduceOverlap matching geometries adjoining ranges', t => {
  const inputFile = mktemp.createFileSync('/tmp/input_XXXXX.geojson')
  const outputFile = mktemp.createFileSync('/tmp/output_XXXXX.geojson')
  const expectedFile = mktemp.createFileSync('/tmp/expected_XXXXX.geojson')

  const A = createFeature({
    housenumber: '51',
    street: 'Cardigan Street',
    suburb: 'Carlton',
    coordinates: [0, 0]
  })
  const B = createFeature({
    housenumber: '53',
    street: 'Cardigan Street',
    suburb: 'Carlton',
    coordinates: [0, 0]
  })
  const C = createFeature({
    housenumber: '55-57',
    street: 'Cardigan Street',
    suburb: 'Carlton',
    coordinates: [0, 0]
  })

  const result = createFeature({
    housenumber: '51-57',
    street: 'Cardigan Street',
    suburb: 'Carlton',
    coordinates: [0, 0]
  })

  // all features to appear in input
  fs.appendFileSync(inputFile, JSON.stringify(A) + '\n')
  fs.appendFileSync(inputFile, JSON.stringify(B) + '\n')
  fs.appendFileSync(inputFile, JSON.stringify(C) + '\n')

  // output expected to join the ranges
  fs.appendFileSync(expectedFile, JSON.stringify(result) + '\n')

  try {
    child_process.execSync(`./bin/reduceOverlap.js --verbose ${inputFile} ${outputFile}`)
  } catch (err) {
    t.fail(err.stdout.toString())
  }

  t.same(
    fs.readFileSync(outputFile, 'utf-8').trim().split('\n').map(JSON.parse),
    fs.readFileSync(expectedFile, 'utf-8').trim().split('\n').map(JSON.parse),
    'adjoining ranges at same location is merged'
  )

  fs.unlinkSync(inputFile)
  fs.unlinkSync(outputFile)
  fs.unlinkSync(expectedFile)

  t.end()
})
