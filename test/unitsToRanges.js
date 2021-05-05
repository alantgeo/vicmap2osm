const test = require('tape')

const unitsToRanges = require('../lib/unitsToRanges.js')

test('units list to addr:flats', t => {
  t.same(
    unitsToRanges([]),
    null,
    'empty input returns empty output'
  )

  t.same(
    unitsToRanges(['1'], 100),
    '1',
    'single unit'
  )

  t.same(
    unitsToRanges(['1', '3']),
    '1;3',
    'two units without a range'
  )

  t.same(
    unitsToRanges(['1', '2']),
    '1-2',
    'two consecutive units form a range'
  )

  t.same(
    unitsToRanges(['1', '2', '3']),
    '1-3',
    'three consecutive units form a range'
  )

  t.same(
    unitsToRanges(['1', '2', '4']),
    '1-2;4',
    'range and singular'
  )

  t.end()
})
