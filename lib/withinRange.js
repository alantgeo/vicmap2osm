/**
 * @param {Object} feature
 * @param {Object} rangeFeature
 * @param {Object} options
 * @param {boolean} options.matchParity - if the parity of the number must match the range to be considered within (eg. if true, then 2 would not be within 1-3 but would be within 2-4 or within 0-4)
 *
 * @returns {boolean} True if addr:housenumber of feature is within the range of addr:housenumber rangeFeature and all other addr:* attributes match
 */
module.exports = (feature, rangeFeature, options) => {
  const regexp = /^(?<pre>\D*)(?<num>\d*)(?<suf>\D*)$/

  if (
    // must have a housenumber
    'addr:housenumber' in feature.properties &&
    'addr:housenumber' in rangeFeature.properties &&

    // must have a street and street must match
    'addr:street' in feature.properties &&
    'addr:street' in rangeFeature.properties &&
    feature.properties['addr:street'] === rangeFeature.properties['addr:street'] &&

    // other higher attributes must match if exists
    feature.properties['addr:suburb'] === rangeFeature.properties['addr:suburb'] &&
    feature.properties['addr:state'] === rangeFeature.properties['addr:state'] &&
    feature.properties['addr:postcode'] === rangeFeature.properties['addr:postcode']
  ) {
    const rangeParts = rangeFeature.properties['addr:housenumber'].split('-')
    if (rangeParts.length === 2) {
      const from = rangeParts[0].match(regexp).groups
      const to = rangeParts[1].match(regexp).groups

      const i = feature.properties['addr:housenumber'].match(regexp).groups
      if (
        Number.isInteger(Number(i.num)) && Number.isInteger(Number(from.num)) && Number.isInteger(Number(to.num)) &&
        Number(i.num) >= Number(from.num) && Number(i.num) <= Number(to.num)
      ) {
        // feature within featureRange (ignore prefix/suffix)
        if (options && options.matchParity) {
          // if parity matches (ie. both number and from/to are even, or both are odd, but not one even and one odd)
          if (
            ((Number(i.num) % 2) === (Number(from.num) % 2)) &&
            ((Number(i.num) % 2) === (Number(to.num) % 2))
          ) {
            return true
          } else {
            return false
          }
        } else {
          return true
        }
      } else {
        return false
      }

    } else {
      // range is not actually  a range
      return false
    }
  } else {
    return false
  }
}
