const test = require('tape')

const valueLimits = require('../lib/valueLimits.js')

test('less than limit', t => {
  t.same(
    valueLimits({
      properties: {
        'addr:flats': ''
      }
    }),
    {
      properties: {
        'addr:flats': ''
      }
    },
    'less than limit'
  )

  t.same(
    valueLimits({
      properties: {
        'addr:flats': '#'.repeat(255)
      }
    }),
    {
      properties: {
        'addr:flats': '#'.repeat(255)
      }
    },
    'exactly at limit'
  )

  t.same(
    valueLimits({
      properties: {
        'addr:flats': '#'.repeat(256)
      }
    }),
    {
      properties: {
        'addr:flats': '#'.repeat(255),
        'addr:flats2': '#'.repeat(1)
      }
    },
    'one over limit'
  )

  t.same(
    valueLimits({
      properties: {
        'addr:flats': '#'.repeat(255 + 255 + 100)
      }
    }),
    {
      properties: {
        'addr:flats': '#'.repeat(255),
        'addr:flats2': '#'.repeat(255),
        'addr:flats3': '#'.repeat(100)
      }
    },
    'split into three'
  )

  t.end()
})
