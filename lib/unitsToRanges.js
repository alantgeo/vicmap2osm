/**
 * Convert a list of unit numbers into an addr:flats list. eg. converts 1,2,3,5 into 1-3;5
 *
 * @param {Array} units
 *
 * @returns {string} addr:flats list
 */
module.exports = (units) => {
  // adapted from https://stackoverflow.com/a/54973116/6702659
  const unitRanges = units
    .slice()
    .sort((a, b) => a - b)
    .reduce((acc, cur, idx, src) => {
      if ((idx > 0) && ((cur - src[idx - 1]) === 1)) {
        acc[acc.length - 1][1] = cur
      } else {
        acc.push([cur])
      }
      return acc
    }, [])
    .map(range => range.join('-'))
  return unitRanges.length ? unitRanges.join(';') : null
}
