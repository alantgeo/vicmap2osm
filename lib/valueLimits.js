/**
 * In OSM tag values are limited to 255 characters.
 * Search for addr:flats beyond that limit and wrap into addr:flats2 addr:flats3 etc.
 * 
 * @param {Object} feature 
 * @returns {boolean}
 */
module.exports = (feature) => {
  if ('addr:flats' in feature.properties && feature.properties['addr:flats'].length > 255) {
    // need to wrap
    const value = feature.properties['addr:flats']
    for (let i = 0; i < value.length; i += 255) {
      feature.properties[`addr:flats${i === 0 ? '' : i / 255 + 1}`] = value.slice(i, i + 255)
    }
  }
  return feature
}
