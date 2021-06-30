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

  t.same(
    unitsToRanges(['3', '1']),
    '1;3',
    'singular sorted'
  )

  t.same(
    unitsToRanges(['1', '2', '5', '4']),
    '1-2;4-5',
    'range sorted'
  )

  t.same(
    unitsToRanges(['1-2', '3-4']),
    '1-4',
    'accepted ranged input'
  )

  t.same(
    unitsToRanges(['1A', '2A']),
    '1A-2A',
    'with suffix'
  )

  t.same(
    unitsToRanges(['1A', '2A', '3']),
    '3;1A-2A',
    'partially with suffix'
  )

  t.same(
    unitsToRanges(['1A', '2B']),
    '1A;2B',
    'different suffix not merged'
  )

  t.same(
    unitsToRanges(['A1b', 'A2b']),
    'A1b-A2b',
    'prefix merged'
  )

  t.same(
    unitsToRanges(['A1b', 'C2d']),
    'A1b;C2d',
    'different prefix not merged'
  )

  t.same(
    unitsToRanges(['1', '1']),
    '1',
    'source duplicates removed'
  )

  t.same(
    unitsToRanges(['1', '1-2']),
    '1-2',
    'source duplicates removed with range'
  )

  t.same(
    unitsToRanges(['1', 'G0 1', '2', '3']),
    '1-3;G0 1',
    'some units unable to parse as prefix number postfix should still be listed'
  )

  t.same(
    unitsToRanges('2,15,3,12,1,9,19,1C,1A,6,14,16,5,5-6,A,B,C,4,17-18,7-8'.split(',')),
    '1-9;12;14-19;1A;1C;A;B;C',
    'complex real world data'
  )

  t.end()
})
