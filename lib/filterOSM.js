module.exports = (feature, options) => {

  // skip any addresses without a housenumber
  if (
    !('addr:housenumber' in feature.properties)
  ) {
    if (options && options.debug) {
      console.log(`PFI ${feature.properties._pfi} has no addr:housenumber, filtering`)
    }
    return false
  }

  return true
}
