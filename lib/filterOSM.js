module.exports = (feature, options) => {

  // skip any addresses without either a housenumber or housename
  // eg PFI 53396626 has no housenumber
  if (
    !('addr:housenumber' in feature.properties) &&
    !('addr:housename' in feature.properties)
  ) {
    if (argv.debug) {
      console.log(`PFI ${feature.properties._pfi} has neither a addr:housename or addr:housenumber, filtering`)
    }
    return false
  }

  return true
}
