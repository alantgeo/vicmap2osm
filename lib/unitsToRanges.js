/**
 * Convert a list of unit numbers into an addr:flats list. Examples:
 * 1,2,3,5 => 1-3;5
 * 1a,2a,3a,5 => 1a-3a;5
 * 1,2,3-5 => 1-5
 * 1,2,3a-5a => 1-2;3a-5a
 *
 * @param {Array} units
 *
 * @returns {string} addr:flats list
 */
module.exports = (units) => {
  const regexp = /^(?<pre>\D*)(?<num>\d*)(?<suf>\D*)$/

  // expand out any existing ranges which may be mixed into the input
  const expandedUnits = units
    .slice()
    .reduce((acc, cur) => {
      const rangeParts = cur.split('-')
      if (rangeParts.length === 2) {
        // was a range, pull out prefix and suffix
        const fromMatch = rangeParts[0].match(regexp)
        const toMatch = rangeParts[1].match(regexp)

        // matching prefix and suffix
        if (fromMatch.groups.pre === toMatch.groups.pre && fromMatch.groups.suf === toMatch.groups.suf) {
          for (let i = fromMatch.groups.num; i <= toMatch.groups.num; i++) {
            acc.push(`${fromMatch.groups.pre}${i}${fromMatch.groups.suf}`)
          }
        } else {
          // prefix/suffix don't match in the from-to, so just pass as is
          console.log(`passed a range with different prefix/suffix: ${rangeParts[0]}-${rangeParts[1]}`)
          acc.push(cur)
        }
      } else if (rangeParts.length > 2) {
        // 1-2-3 not sure if this ever occures, but just pass as is
        console.log(`Unsupported range ${cur}`)
        acc.push(cur)
      } else {
        // was not a range
        acc.push(cur)
      }
      return acc
    }, [])

  // combine individual unit values into ranges
  const existingRanges = []

  // adapted from https://stackoverflow.com/a/54973116/6702659
  const formedRanges = expandedUnits
    .slice()
    .map(unit => {
      if (unit.split('-').length > 1) {
        existingRanges.push(unit)
        return []
      } else {
        return [unit]
      }
    })
    .flat()
    .sort((a, b) => a - b)
    .reduce((acc, cur, idx, src) => {
      const curParts = cur.match(regexp)
      const prevParts = idx > 0 ? src[idx - 1].match(regexp) : null

      const curNum = curParts.groups.num
      const prevNum = prevParts ? prevParts.groups.num : null

      if ((idx > 0) && ((curNum - prevNum) === 1)) {
        if (prevParts ? (curParts.groups.pre === prevParts.groups.pre && curParts.groups.suf === prevParts.groups.suf) : true) {
          acc[acc.length - 1][1] = cur
        } else {
          acc.push([cur])
        }
      } else {
        acc.push([cur])
      }
      return acc
    }, [])
    .map(range => range.join('-'))

  const unitRanges = [...formedRanges, ...existingRanges]

  return unitRanges.length ? unitRanges.join(';') : null
}
