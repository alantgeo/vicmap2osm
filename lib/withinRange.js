/**
 * @param {Object} feature
 * @param {Object} rangeFeature
 * @param {Object} [options]
 * @param {boolean} [options.matchParity=false] - if the parity of the number must match the range to be considered within (eg. if true, then 2 would not be within 1-3 but would be within 2-4 or within 0-4)
 * @param {boolean} [options.checkHigherOrderAddrKeys=true] - if true checks that addr:suburb, addr:state, addr:postcode also match
 * @param {boolean} [options.checkStreet=true] - if true checks that addr:street matches
 *
 * @returns {boolean} True if addr:housenumber of feature is within the range of addr:housenumber rangeFeature and all other addr:* attributes match, ignoring any unit from a "unit/number" style addr:housenumber of rangeFeature
 */
module.exports = (feature, rangeFeature, options) => {
  const regexp = /^(?<pre>\D*)(?<num>\d*)(?<suf>\D*)$/

  const checkStreet = options && 'checkStreet' in options ? options.checkStreet : true
  const checkHigherOrderAddrKeys = options && 'checkHigherOrderAddrKeys' in options ? options.checkHigherOrderAddrKeys : true

  if (
    // must have a housenumber
    'addr:housenumber' in feature.properties &&
    'addr:housenumber' in rangeFeature.properties &&

    // must have a street and street must match
    (
      checkStreet ? (
        'addr:street' in feature.properties &&
        'addr:street' in rangeFeature.properties &&
        (feature.properties['addr:street'] || '').toLowerCase().replaceAll(' ', '') === (rangeFeature.properties['addr:street'] || '').toLowerCase().replaceAll(' ', '')
      ) : true
    ) &&

    // other higher attributes must match if exists
    (
      checkHigherOrderAddrKeys ? (
        feature.properties['addr:suburb'] === rangeFeature.properties['addr:suburb'] &&
        feature.properties['addr:state'] === rangeFeature.properties['addr:state'] &&
        feature.properties['addr:postcode'] === rangeFeature.properties['addr:postcode']
      ) : true
    )
  ) {
    const rangeNumber = rangeFeature.properties["addr:housenumber"].split("/").length > 1 ? rangeFeature.properties["addr:housenumber"].split("/")[1] : rangeFeature.properties["addr:housenumber"];
    const rangeParts = rangeNumber.split('-')
    if (rangeParts.length === 2) {
      const fromMatch = rangeParts[0].match(regexp)
      const toMatch = rangeParts[1].match(regexp)

      if (!fromMatch || !toMatch) {
        console.log(`range ${rangeNumber} didn't match regexp`, rangeFeature)
        return false
      }
      const from = rangeParts[0].match(regexp).groups
      const to = rangeParts[1].match(regexp).groups

      const iParts = feature.properties['addr:housenumber'].split('-')
      let iFrom
      let iTo
      let iRange = false
      let match
      if (iParts.length === 2) {
        iRange = true
        iFrom = iParts[0].match(regexp).groups
        iTo = iParts[1].match(regexp).groups
      } else {
        match = feature.properties['addr:housenumber'].match(regexp)
        if (!match) {
          console.log(`${feature.properties['addr:housenumber']} didn't match regexp`, feature)
        }
      }
      const i = iRange ? null : match.groups
      if (
        iRange ? (
          Number.isInteger(Number(iFrom.num)) && Number.isInteger(Number(iTo.num)) && Number.isInteger(Number(from.num)) && Number.isInteger(Number(to.num)) &&
          (
            (Number(iFrom.num) >= Number(from.num) && Number(iFrom.num) <= Number(to.num))
            ||
            (Number(iTo.num) >= Number(from.num) && Number(iTo.num) <= Number(to.num))
          )
        ) : (
          Number.isInteger(Number(i.num)) && Number.isInteger(Number(from.num)) && Number.isInteger(Number(to.num)) &&
          Number(i.num) >= Number(from.num) && Number(i.num) <= Number(to.num)
        )
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
