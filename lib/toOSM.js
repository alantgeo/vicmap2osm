const { capitalCase } = require('capital-case')

const buildingUnitType = require('./buildingUnitType.js')
const roadSuffixMap = require('./roadSuffixMap.js')
const suburbMap = require('./suburbMap.js')

// likely these are not proper names, so we will ignore them
const emptyNames = [
  'UNNAMED',
  'NOT NAMED'
]

/**
 * Transforms a GeoJSON Feature from the Vicmap address schema into OSM schema
 *
 * @param {Array} sourceFeature Feature in Vicmap address schema
 * @param {Object} [options]
 * @param {string} [options.tracing=false]
 * @param {string} [options.includeUnitPrefix=false] include addr:unit:prefix to indicate unit type (UNIT, SHOP, SUITE, FLAT, etc.)
 * @param {string} [options.includeDerivableProperties=false] include properties addr:suburb, addr:postcode, addr:state which can be derived from existing boundaries on each address object
 * @returns {Object} Feature in OSM schema
 */
module.exports = (sourceFeature, options) => {

  const outputFeature = Object.assign({}, sourceFeature)
  const sourceProperties = sourceFeature.properties
  const outputProperties = {}

  if (options && options.tracing) {
    outputProperties['_pfi'] = sourceProperties.PFI
  }

  // Building unit
  // bld_unit_*
  const bld_unit_1 = [
      sourceProperties.BLG_UNIT_PREFIX_1,
      sourceProperties.BLG_UNIT_ID_1 || null, // 0 is used for an empty value in the source data, so convert 0 to null
      sourceProperties.BLG_UNIT_SUFFIX_1,
    ].join("") || null;

  const bld_unit_2 = [
      sourceProperties.BLG_UNIT_PREFIX_2,
      sourceProperties.BLG_UNIT_ID_2 || null, // 0 is used for an empty value in the source data, so convert 0 to null
      sourceProperties.BLG_UNIT_SUFFIX_2,
    ].join("") || null;

  // if both 1 and 2 defined, then use a range 1-2 otherwise just select the one which was defined
  let bld_unit = null
  if (sourceProperties.HSA_FLAG === 'Y') {
    bld_unit = sourceProperties.HSA_UNIT_ID
  } else {
    if (bld_unit_1 && bld_unit_2) {
      bld_unit = `${bld_unit_1}-${bld_unit_2}`
    } else if (bld_unit_1) {
      bld_unit = bld_unit_1
    } else if (bld_unit_2) {
      bld_unit = bld_unit_2
    }
  }

  if (bld_unit) {
    if (options && options.includeUnitPrefix) {
      // building unit type (Unit, Shop, Suite...)
      if (sourceProperties.BLG_UNIT_TYPE) {
        if (sourceProperties.BLG_UNIT_TYPE in buildingUnitType) {
          outputProperties['addr:unit:prefix'] = capitalCase(buildingUnitType[sourceProperties.BLG_UNIT_TYPE])
        } else {
          if (options && options.debug) {
            console.log(`Building Unity Type ${sourceProperties.BLG_UNIT_TYPE} not recognised for ${sourceFeature}`)
          }
        }
      }
    }

    outputProperties['addr:unit'] = bld_unit
  }

  // house number
  // house_*
  const house_1 = [
    sourceProperties.HOUSE_PREFIX_1,
    sourceProperties.HOUSE_NUMBER_1 || null, // 0 is used for an empty value in the source data, so convert 0 to null
    sourceProperties.HOUSE_SUFFIX_1,
  ].join("");

  const house_2 = [
    sourceProperties.HOUSE_PREFIX_2,
    sourceProperties.HOUSE_NUMBER_2 || null, // 0 is used for an empty value in the source data, so convert 0 to null
    sourceProperties.HOUSE_SUFFIX_2,
  ].join("");

  let housenumber = null
  if (house_1 && house_2) {
    housenumber = `${house_1}-${house_2}`
  } else if (house_1) {
    housenumber = house_1
  } else if (house_2) {
    housenumber = house_2
  }

  if (housenumber) {
    outputProperties['addr:housenumber'] = housenumber
  }

  // display numbers used predominately in the City of Melbourne CBD by large properties.
  // Primarily to simplify an assigned number range. 
  // so should map the assigned address or the signposted address?

  // every record has at least ROAD_NAME populated
  if (sourceProperties.ROAD_NAME && !emptyNames.includes(sourceProperties.ROAD_NAME)) {
    outputProperties['addr:street'] = capitalCase([
      sourceProperties.ROAD_NAME,
      sourceProperties.ROAD_TYPE,
      sourceProperties.ROAD_SUFFIX in roadSuffixMap ? roadSuffixMap[sourceProperties.ROAD_SUFFIX] : sourceProperties.ROAD_SUFFIX
    ].join(' '))
  }

  if (options && options.includeDerivableProperties) {
    // every record has LOCALITY populated, however some values should be empty
    if (sourceProperties.LOCALITY_NAME && !emptyNames.includes(sourceProperties.LOCALITY_NAME)) {
      const suburb = capitalCase(sourceProperties.LOCALITY_NAME)

      // some special cases are defined in suburbMap
      outputProperties['addr:suburb'] = suburb in suburbMap ? suburbMap[suburb] : suburb
    }

    // every record has STATE populated
    if (sourceProperties.STATE) {
      outputProperties['addr:state'] = sourceProperties.STATE
    }

    // some records have no POSTCODE populated
    if (sourceProperties.POSTCODE) {
      outputProperties['addr:postcode'] = sourceProperties.POSTCODE
    }
  }

  outputFeature.properties = outputProperties
  return outputFeature
}
