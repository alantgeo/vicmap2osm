module.exports = (feature) => {

  // skip any addresses without a housenumber
  // eg PFI 53396626 has no housenumber
  if (!('addr:housenumber' in feature.properties)) {
    return false
  }

  return true
}
