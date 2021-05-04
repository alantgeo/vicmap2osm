const { capitalCase } = require('capital-case')

const buildingUnitType = {
  ANT: 'ANTENNA',
  APT: 'APARTMENT',
  ATM: 'ATM',
  BBOX: 'BATHING BOX',
  BERT: 'BERTH',
  BLDG: 'BUILDING',
  BTSD: 'BOATSHED',
  CARP: 'CARPARK',
  CARS: 'CARSPACE',
  CARW: 'CARWASH',
  CHAL: 'CHALET',
  CLUB: 'CLUB',
  CTGE: 'COTTAGE',
  CTYD: 'COURTYARD',
  DUPL: 'DUPLEX',
  FCTY: 'FACTORY',
  FLAT: 'FLAT',
  GATE: 'GARAGE',
  GRGE: 'GATE',
  HALL: 'HALL',
  HELI: 'HELIPORT',
  HNGR: 'HANGAR',
  HOST: 'HOSTEL',
  HSE: 'HOUSE',
  KSK: 'KIOSK',
  LOT: 'LOT',
  MBTH: 'MAISONETTE',
  OFFC: 'OFFICE',
  PSWY: 'PASSAGEWAY',
  PTHS: 'PENTHOUSE',
  REST: 'RESTAURANT',
  RESV: 'RESERVE',
  ROOM: 'ROOM',
  RPTN: 'RECPETION',
  SAPT: 'STUDIO APARTMENT',
  SE: 'SUITE',
  SHCS: 'SHOWCASE',
  SHED: 'SHED',
  SHOP: 'SHOP',
  SHRM: 'SHOWROOM',
  SIGN: 'SIGN',
  SITE: 'SITE',
  STLL: 'STALL',
  STOR: 'STORE',
  STR: 'STRATA UNIT',
  STU: 'STUDIO',
  SUBS: 'SUBSTATION',
  TNCY: 'TENANCY',
  TNHS: 'TOWNHOUSE',
  TWR: 'TOWER',
  UNIT: 'UNIT',
  VLLA: 'VILLA',
  VLT: 'VAULT',
  WHSE: 'WAREHOUSE',
  WKSH: 'WORKSHOP'
}

// likely these are not proper names, so we will ignore them
const emptyNames = [
  'UNNAMED',
  'NOT NAMED'
]

/**
 * Transforms a GeoJSON Feature from the Vicmap address schema into OSM schema
 *
 * @param {Array} sourceFeature Feature in Vicmap address schema
 * @returns {Object} Feature in OSM schema
 */
module.exports = (sourceFeature, options) => {

  const outputFeature = Object.assign({}, sourceFeature)
  const sourceProperties = sourceFeature.properties
  const outputProperties = {}

  if (options && options.tracing) {
    outputProperties['_pfi'] = sourceProperties.PFI
  }

  // Building sub address type (eg UNIT OFFICE SHOP)
  //
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
    outputProperties['addr:unit'] = bld_unit
  }

  /*
  if (sourceProperties.BLGUNTTYP && sourceProperties.BLGUNTTYP in buildingUnitType) {
    outputProperties['addr:unit:type'] = buildingUnitType[sourceProperties.BLGUNTTYP]
  }
  */

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

  // display numbers used predominately in the City of Melbourne CBD by large properties. Primarily to simplify an assigned number range. 
  // so should map the assigned address or the signposted address?

  // every record has at least ROAD_NAME populated
  if (sourceProperties.ROAD_NAME && !emptyNames.includes(sourceProperties.ROAD_NAME)) {
    outputProperties['addr:street'] = capitalCase([
      sourceProperties.ROAD_NAME,
      sourceProperties.ROAD_TYPE,
      sourceProperties.RD_SUF
    ].join(' '))
  }

  // every record has LOCALITY populated, however some values should be empty
  if (sourceProperties.LOCALITY && !emptyNames.includes(sourceProperties.LOCALITY)) {
    outputProperties['addr:suburb'] = capitalCase(sourceProperties.LOCALITY)
  }

  // every record has STATE populated
  if (sourceProperties.STATE) {
    outputProperties['addr:state'] = sourceProperties.STATE
  }

  // some records have no POSTCODE populated
  if (sourceProperties.POSTCODE) {
    outputProperties['addr:postcode'] = sourceProperties.POSTCODE
  }

  outputFeature.properties = outputProperties
  return outputFeature
}
