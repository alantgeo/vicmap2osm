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

const roadSuffixMap = {
  N: 'North',
  S: 'South',
  E: 'East',
  W: 'West'
}

const suburbMap = {
  // likely due to our capital case code
  'Mccrae': 'McCrae',
  'Mckinnon': 'McKinnon',
  'Mcmillans': 'McMillans',
  'Bend Of Islands': 'Bend of Islands',
  'Bridgewater On Loddon': 'Bridgewater on Loddon',
  'Hmas Cerberus': 'HMAS Cerberus',
  'Mckenzie Creek': 'McKenzie Creek',
  'Mcmahons Creek': 'McMahons Creek',
  'Murray Sunset': 'Murray-Sunset',
  'Yalla Y Poora': 'Yalla-y-poora',

  // because these locality names are used more than once, the vicmap data has added a suffix for clarity
  'Bellfield Greater Melbourne': 'Bellfield',

  'Hillside Greater Melbourne': 'Hillside',
  'Hillside Bairnsdale': 'Hillside',

  'Springfield Romsey': 'Springfield',
  'Springfield Sea Lake': 'Springfield',

  'Moonlight Flat Castlemaine': 'Moonlight Flat',
  'Moonlight Flat Maryborough': 'Moonlight Flat',

  'Golden Point Castlemaine': 'Golden Point',
  'Golden Point Ballarat': 'Golden Point',
  'Golden Point Maryborough': 'Maryborough',

  'Ascot Ballarat': 'Ascot',
  'Ascot Bendigo': 'Ascot',

  'Big Hill Bendigo': 'Big Hill',
  'Big Hill Lorne': 'Big Hill',

  'Black Range Stawell': 'Black Range',

  'Fairy Dell Bairnsdale': 'Fairy Dell',
  'Fairy Dell Rochester': 'Fairy Dell',

  'Happy Valley Ballarat': 'Happy Valley',
  'Happy Valley Robinvale': 'Happy Valley',

  'Killara Casterton': 'Killara',
  'Killara Wodonga': 'Killara',

  'Merrijig Bairnsdale': 'Merrijig',
  'Merrijig Mount Buller': 'Merrijig',

  'Myall Kerang': 'Myall',
  'Myall Sea Lake': 'Myall',

  'Newtown Ballarat': 'Newtown',
  'Newtown Geelong': 'Newtown',

  'Stony Creek Foster': 'Stony Creek',
  'Stony Creek Talbot': 'Stony Creek',

  'Thomson Geelong': 'Thomson'
}

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
    // building unit type (Unit, Shop, Suite...)
    // only included if a unit value is set
    /* currently ommitted
    if (sourceProperties.BLGUNTTYP) {
      if (sourceProperties.BLGUNTTYP in buildingUnitType) {
        outputProperties['addr:unit:prefix'] = capitalCase(buildingUnitType[sourceProperties.BLGUNTTYP])
      } else {
        if (options && options.debug) {
          console.log(`Building Unity Type ${sourceProperties.BLGUNTTYP} not recognised for ${sourceFeature}`)
        }
      }
    }
    */

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

  outputFeature.properties = outputProperties
  return outputFeature
}
