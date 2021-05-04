module.exports = (feature, options) => {

  // skip any addresses without a housenumber
  // eg PFI 53396626 has no housenumber
  if (
    !('addr:housenumber' in feature.properties)
  ) {
    if (argv.debug) {
      console.log(`PFI ${feature.properties._pfi} has no addr:housenumber, filtering`)
    }
    return false
  }

  return true
}
