/**
 * Filters features based on the OSM schema from toOSM
 * 
 * @param {Object} feature 
 * @returns {boolean}
 */
module.exports = (feature) => {

  // skip any addresses without a housenumber
  if (
    !('addr:housenumber' in feature.properties)
  ) {
    return false
  }

  return true
}
