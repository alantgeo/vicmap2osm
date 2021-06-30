/**
 * @param {Object} feature
 * @param {Object} rangeFeature
 *
 * @returns {boolean} True if addr:housenumber of feature is within the range of addr:housenumber rangeFeature and all other addr:* attributes match
 */
module.exports = (feature, rangeFeature) => {
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
        return true
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
