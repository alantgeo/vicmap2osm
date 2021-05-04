const test = require('tape')

const cluster = require('../cluster.js')

const A = {
  type: 'Feature',
  id: 'A',
  properties: {},
  geometry: {
    type: 'Point',
    coordinates: [0, 0]
  }
}

const B = {
  type: 'Feature',
  id: 'B',
  properties: {},
  geometry: {
    type: 'Point',
    coordinates: [0, 0]
  }
}

const C = {
  type: 'Feature',
  id: 'C',
  properties: {},
  geometry: {
    type: 'Point',
    coordinates: [0.000001, 0.000001]
  }
}

const D = {
  type: 'Feature',
  id: 'D',
  properties: {},
  geometry: {
    type: 'Point',
    coordinates: [1, 1]
  }
}

test('cluster', t => {
  t.same(
    cluster([], 100),
    [],
    'empty input returns empty output'
  )

  t.same(
    cluster([A], 100),
    [[A]],
    'single feature input returns single feature output cluster'
  )

  t.same(
    cluster([A, B], 100),
    [[A, B]],
    'overlapping points clustered'
  )

  t.same(
    cluster([A, C], 100),
    [[A, C]],
    'nearby points clustered'
  )

  t.same(
    cluster([A, D], 100),
    [[A], [D]],
    'far away points not clustered'
  )

  t.same(
    cluster([A, B, C, D], 100),
    [[A, B, C], [D]],
    'some clustered others not'
  )

  t.end()
})
