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
    sourceProperties.BUNIT_PRE1,
    sourceProperties.BUNIT_ID1 || null, // 0 is used for an empty value in the source data, so convert 0 to null
    sourceProperties.BUNIT_SUF1
  ].join('') || null

  const bld_unit_2 = [
    sourceProperties.BUNIT_PRE2,
    sourceProperties.BUNIT_ID2 || null, // 0 is used for an empty value in the source data, so convert 0 to null
    sourceProperties.BUNIT_SUF2
  ].join('') || null

  // if both 1 and 2 defined, then use a range 1-2 otherwise just select the one which was defined
  let bld_unit = null
  if (sourceProperties.HSA_FLAG === 'Y') {
    bld_unit = sourceProperties.HSAUNITID
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
      if (sourceProperties.BLGUNTTYP) {
        if (sourceProperties.BLGUNTTYP in buildingUnitType) {
          outputProperties['addr:unit:prefix'] = capitalCase(buildingUnitType[sourceProperties.BLGUNTTYP])
        } else {
          if (options && options.debug) {
            console.log(`Building Unity Type ${sourceProperties.BLGUNTTYP} not recognised for ${sourceFeature}`)
          }
        }
      }
    }

    outputProperties['addr:unit'] = bld_unit
  }

  // house number
  // house_*
  const house_1 = [
    sourceProperties.HSE_PREF1,
    sourceProperties.HSE_NUM1 || null, // 0 is used for an empty value in the source data, so convert 0 to null
    sourceProperties.HSE_SUF1
  ].join('')

  const house_2 = [
    sourceProperties.HSE_PREF2,
    sourceProperties.HSE_NUM2 || null, // 0 is used for an empty value in the source data, so convert 0 to null
    sourceProperties.HSE_SUF2
  ].join('')

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
      sourceProperties.RD_SUF in roadSuffixMap ? roadSuffixMap[sourceProperties.RD_SUF] : sourceProperties.RD_SUF
    ].join(' '))
  }

  if (options && options.includeDerivableProperties) {
    // every record has LOCALITY populated, however some values should be empty
    if (sourceProperties.LOCALITY && !emptyNames.includes(sourceProperties.LOCALITY)) {
      const suburb = capitalCase(sourceProperties.LOCALITY)

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
