const test = require('tape')

const withinRange = require('../lib/withinRange.js')

const A = {
  "type": "Feature",
  "properties": {
    "addr:housenumber": "1",
    "addr:street": "Main Street"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [0, 0]
  }
}
const B = {
  "type": "Feature",
  "properties": {
    "addr:housenumber": "2",
    "addr:street": "Main Street"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [0, 0]
  }
}
const C = {
  "type": "Feature",
  "properties": {
    "addr:housenumber": "3",
    "addr:street": "Main Street"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [0, 0]
  }
}
const AB = {
  "type": "Feature",
  "properties": {
    "addr:housenumber": "1-2",
    "addr:street": "Main Street"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [0, 0]
  }
}
const AC = {
  "type": "Feature",
  "properties": {
    "addr:housenumber": "1-3",
    "addr:street": "Main Street"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [0, 0]
  }
}

const AC_2 = {
  "type": "Feature",
  "properties": {
    "addr:housenumber": "1-3",
    "addr:street": "Second Street"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [0, 0]
  }
}

const subNumber = {
  "type": "Feature",
  "properties": {
    "addr:housenumber": "12C",
    "addr:street": "Main Street"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [0, 0]
  }
}
const rangeOutsideSub = {
  "type": "Feature",
  "properties": {
    "addr:housenumber": "118-120",
    "addr:street": "Main Street"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [0, 0]
  }
}

const B_withSuburb = {
  "type": "Feature",
  "properties": {
    "addr:housenumber": "2",
    "addr:street": "Main Street",
    "addr:suburb": "Suburb A"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [0, 0]
  }
}
const AC_withDifferentSuburb = {
  "type": "Feature",
  "properties": {
    "addr:housenumber": "1-3",
    "addr:street": "Main Street",
    "addr:suburb": "Suburb B"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [0, 0]
  }
}

const AD = {
  "type": "Feature",
  "properties": {
    "addr:housenumber": "1-4",
    "addr:street": "Main Street"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [0, 0]
  }
}
const BC = {
  "type": "Feature",
  "properties": {
    "addr:housenumber": "2-3",
    "addr:street": "Main Street"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [0, 0]
  }
}
const CE = {
  "type": "Feature",
  "properties": {
    "addr:housenumber": "3-5",
    "addr:street": "Main Street"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [0, 0]
  }
}
const DE = {
  "type": "Feature",
  "properties": {
    "addr:housenumber": "4-5",
    "addr:street": "Main Street"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [0, 0]
  }
}

test('withinRange', t => {
  t.same(
    withinRange(A, AB),
    true,
    'A within AB'
  )
  t.same(
    withinRange(A, AC),
    true,
    'A within AC'
  )
  t.same(
    withinRange(B, AB),
    true,
    'B within AB'
  )
  t.same(
    withinRange(B, AC),
    true,
    'B within AC'
  )
  t.same(
    withinRange(C, AB),
    false,
    'C not within AB'
  )
  t.same(
    withinRange(A, AC_2),
    false,
    'A Main Street not within AC Secondary Street'
  )
  t.same(
    withinRange(subNumber, rangeOutsideSub),
    false,
    '12C not within 118-120'
  )

  t.same(
    withinRange(B, AC, { matchParity: true }),
    false,
    'B not within AC when matching parity'
  )

  t.same(
    withinRange(B_withSuburb, AC_withDifferentSuburb),
    false,
    'by default checks suburbs match for within to pass'
  )

  t.same(
    withinRange(B_withSuburb, AC_withDifferentSuburb, {
      checkHigherOrderAddrKeys: false
    }),
    true,
    'within range when ignoring higher order addr keys'
  )

  t.same(
    withinRange(BC, AD),
    true,
    'range completely within range'
  )
  t.same(
    withinRange(CE, AD),
    true,
    'range overlapping within range'
  )
  t.same(
    withinRange(DE, AD),
    true,
    'range touching endpoints of range'
  )

  t.end()
})
