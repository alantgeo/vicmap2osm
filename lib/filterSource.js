// whitelist of building unit types to include
// other building unit types like carspace we skip
const buildingUnitTypeWhitelist = [
  'APT', // apartment
  'BLDG', // building
  'CHAL', // chalet
  'CTGE', // cottage
  'FLAT', // flat
  'HSE', // house
  'OFFC', // office
  'SAPT', // studio apartment
  'SE', // suite
  'SHOP', // shop
  'STR', // strata unit
  'TNHS', // townhouse
  'UNIT', // unit
  'VLLA' // villa
]

/**
 * Filters features based on the source schema
 * 
 * @param {Object} feature 
 * @returns {boolean}
 */
module.exports = (feature) => {

  // if the address has a building unit type, only allow a few whitelisted types
  if ('BLGUNTTYP' in feature.properties && feature.properties.BLGUNTTYP !== null) {
    if (buildingUnitTypeWhitelist.includes(feature.properties.BLGUNTTYP)) {
      // building unit type in the whitelist, include feature
      return true
    } else {
      // building unit type is set and not in the whitelist, drop feature
      return false
    }
  } else {
    // building unit type not set, include feature
    return true
  }
}
