const test = require('tape')

const toOSM = require('../lib/toOSM.js')

test('toOSM basic address schema', t => {
  t.plan(1)

  const input = { "type": "Feature", "properties": { "PFI": "52043942", "PROPERTY_PFI": "602441", "EZI_ADDRESS": "3 BAY ROAD JAM JERRUP 3984", "SOURCE": "LGO", "SOURCE_VERIFIED": "2008\/12\/29 00:00:00", "IS_PRIMARY": "Y", "PROPERTY_STATUS": "A", "GEOCODE_FEATURE": "E", "DISTANCE_RELATED_FLAG": "Y", "LOCATION_DESCRIPTOR": null, "BLG_UNIT_TYPE": null, "HSA_FLAG": "N", "HSA_UNIT_ID": null, "BLG_UNIT_PREFIX_1": null, "BLG_UNIT_ID_1": null, "BLG_UNIT_SUFFIX_1": null, "BLG_UNIT_PREFIX_2": null, "BLG_UNIT_ID_2": null, "BLG_UNIT_SUFFIX_2": null, "FLOOR_TYPE": null, "FLOOR_PREFIX_1": null, "FLOOR_NO_1": null, "FLOOR_SUFFIX_1": null, "FLOOR_PREFIX_2": null, "FLOOR_NO_2": null, "FLOOR_SUFFIX_2": null, "BUILDING_NAME": null, "COMPLEX_NAME": null, "HOUSE_PREFIX_1": null, "HOUSE_NUMBER_1": 3.0, "HOUSE_SUFFIX_1": null, "HOUSE_PREFIX_2": null, "HOUSE_NUMBER_2": null, "HOUSE_SUFFIX_2": null, "DISP_PREFIX_1": null, "DISP_NUMBER_1": null, "DISP_SUFFIX_1": null, "DISP_PREFIX_2": null, "DISP_NUMBER_2": null, "DISP_SUFFIX_2": null, "ROAD_NAME": "BAY", "ROAD_TYPE": "ROAD", "ROAD_SUFFIX": null, "LOCALITY_NAME": "JAM JERRUP", "LGA_CODE": "304", "STATE": "VIC", "POSTCODE": "3984", "MESH_BLOCK": "20034062000", "NUM_ROAD_ADDRESS": "3 BAY ROAD", "NUM_ADDRESS": "3", "ADDRESS_CLASS": "S", "ADD_ACCESS_TYPE": "L", "OUTSIDE_PROPERTY": "N", "COMPLEX_SITE": "N", "LABEL_ADDRESS": "Y", "FEATURE_QUALITY_ID": "RA_NO_208", "PFI_CREATED": null, "UFI": 461425466.0, "UFI_CREATED": "2009\/09\/23 00:00:00", "UFI_OLD": null }, "geometry": { "type": "Point", "coordinates": [ 145.5434286, -38.326053 ] } }

  const output = {
    type: 'Feature',
    properties: {
      'addr:housenumber': '3',
      'addr:street': 'Bay Road',
      'addr:suburb': 'Jam Jerrup',
      'addr:state': 'VIC',
      'addr:postcode': '3984'
    },
    geometry: {
      type: 'Point',
      coordinates: [ 145.5434286, -38.326053 ]
    }
  }

  t.same(toOSM(input, { includeDerivableProperties: true }), output)
})

test('toOSM suffix', t => {
  t.plan(1)

  const input = { "type": "Feature", "properties": { "PFI": "212027680", "PROPERTY_PFI": "212027679", "EZI_ADDRESS": "24A FORESHORE ROAD JAM JERRUP 3984", "SOURCE": "LGO", "SOURCE_VERIFIED": "2009\/01\/05 00:00:00", "IS_PRIMARY": "Y", "PROPERTY_STATUS": "A", "GEOCODE_FEATURE": "V", "DISTANCE_RELATED_FLAG": "N", "LOCATION_DESCRIPTOR": null, "BLG_UNIT_TYPE": null, "HSA_FLAG": "N", "HSA_UNIT_ID": null, "BLG_UNIT_PREFIX_1": null, "BLG_UNIT_ID_1": null, "BLG_UNIT_SUFFIX_1": null, "BLG_UNIT_PREFIX_2": null, "BLG_UNIT_ID_2": null, "BLG_UNIT_SUFFIX_2": null, "FLOOR_TYPE": null, "FLOOR_PREFIX_1": null, "FLOOR_NO_1": null, "FLOOR_SUFFIX_1": null, "FLOOR_PREFIX_2": null, "FLOOR_NO_2": null, "FLOOR_SUFFIX_2": null, "BUILDING_NAME": null, "COMPLEX_NAME": null, "HOUSE_PREFIX_1": null, "HOUSE_NUMBER_1": 24.0, "HOUSE_SUFFIX_1": "A", "HOUSE_PREFIX_2": null, "HOUSE_NUMBER_2": null, "HOUSE_SUFFIX_2": null, "DISP_PREFIX_1": null, "DISP_NUMBER_1": null, "DISP_SUFFIX_1": null, "DISP_PREFIX_2": null, "DISP_NUMBER_2": null, "DISP_SUFFIX_2": null, "ROAD_NAME": "FORESHORE", "ROAD_TYPE": "ROAD", "ROAD_SUFFIX": null, "LOCALITY_NAME": "JAM JERRUP", "LGA_CODE": "304", "STATE": "VIC", "POSTCODE": "3984", "MESH_BLOCK": "20034980000", "NUM_ROAD_ADDRESS": "24A FORESHORE ROAD", "NUM_ADDRESS": "24A", "ADDRESS_CLASS": "S", "ADD_ACCESS_TYPE": "L", "OUTSIDE_PROPERTY": "N", "COMPLEX_SITE": "N", "LABEL_ADDRESS": "Y", "FEATURE_QUALITY_ID": null, "PFI_CREATED": "2008\/11\/06 00:00:00", "UFI": 462075378.0, "UFI_CREATED": "2009\/09\/23 00:00:00", "UFI_OLD": null }, "geometry": { "type": "Point", "coordinates": [  145.5171569, -38.3251239 ] } }

  const output = {
    type: 'Feature',
    properties: {
      'addr:housenumber': '24A',
      'addr:street': 'Foreshore Road',
      'addr:suburb': 'Jam Jerrup',
      'addr:state': 'VIC',
      'addr:postcode': '3984'
    },
    geometry: {
      type: 'Point',
      coordinates: [ 145.5171569, -38.3251239 ]
    }
  }

  t.same(toOSM(input, { includeDerivableProperties: true }), output)
})

test('toOSM simple range X-Y', t => {
  t.plan(1)

  const input = { "type": "Feature", "properties": { "PFI": "51988731", "PROPERTY_PFI": "910693", "EZI_ADDRESS": "29-47 HILLMARTIN LANE DIAMOND CREEK 3089", "SOURCE": "LGO", "SOURCE_VERIFIED": "2010\/01\/13 00:00:00", "IS_PRIMARY": "Y", "PROPERTY_STATUS": "A", "GEOCODE_FEATURE": "V", "DISTANCE_RELATED_FLAG": "N", "LOCATION_DESCRIPTOR": null, "BLG_UNIT_TYPE": null, "HSA_FLAG": "N", "HSA_UNIT_ID": null, "BLG_UNIT_PREFIX_1": null, "BLG_UNIT_ID_1": null, "BLG_UNIT_SUFFIX_1": null, "BLG_UNIT_PREFIX_2": null, "BLG_UNIT_ID_2": null, "BLG_UNIT_SUFFIX_2": null, "FLOOR_TYPE": null, "FLOOR_PREFIX_1": null, "FLOOR_NO_1": null, "FLOOR_SUFFIX_1": null, "FLOOR_PREFIX_2": null, "FLOOR_NO_2": null, "FLOOR_SUFFIX_2": null, "BUILDING_NAME": null, "COMPLEX_NAME": null, "HOUSE_PREFIX_1": null, "HOUSE_NUMBER_1": 29.0, "HOUSE_SUFFIX_1": null, "HOUSE_PREFIX_2": null, "HOUSE_NUMBER_2": 47.0, "HOUSE_SUFFIX_2": null, "DISP_PREFIX_1": null, "DISP_NUMBER_1": null, "DISP_SUFFIX_1": null, "DISP_PREFIX_2": null, "DISP_NUMBER_2": null, "DISP_SUFFIX_2": null, "ROAD_NAME": "HILLMARTIN", "ROAD_TYPE": "LANE", "ROAD_SUFFIX": null, "LOCALITY_NAME": "DIAMOND CREEK", "LGA_CODE": "356", "STATE": "VIC", "POSTCODE": "3089", "MESH_BLOCK": "20515970000", "NUM_ROAD_ADDRESS": "29-47 HILLMARTIN LANE", "NUM_ADDRESS": "29-47", "ADDRESS_CLASS": "S", "ADD_ACCESS_TYPE": "L", "OUTSIDE_PROPERTY": "N", "COMPLEX_SITE": "N", "LABEL_ADDRESS": "Y", "FEATURE_QUALITY_ID": null, "PFI_CREATED": null, "UFI": 461284870.0, "UFI_CREATED": "2008\/07\/23 00:00:00", "UFI_OLD": null }, "geometry": { "type": "Point", "coordinates": [ 145.1361894, -37.6704613 ] } }

  const output = {
    type: 'Feature',
    properties: {
      'addr:housenumber': '29-47',
      'addr:street': 'Hillmartin Lane',
      'addr:suburb': 'Diamond Creek',
      'addr:state': 'VIC',
      'addr:postcode': '3089'
    },
    geometry: {
      type: 'Point',
      coordinates: [ 145.1361894, -37.6704613 ]
    }
  }

  t.same(toOSM(input, { includeDerivableProperties: true }), output)
})

test('toOSM range with suffix Xa-Yb', t => {
  t.plan(1)

  const input = { "type": "Feature", "properties": { "PFI": "207999843", "PROPERTY_PFI": "207999842", "EZI_ADDRESS": "9B-9D OLSEN PLACE BROADMEADOWS 3047", "SOURCE": "LGO", "SOURCE_VERIFIED": "2009\/01\/21 00:00:00", "IS_PRIMARY": "Y", "PROPERTY_STATUS": "A", "GEOCODE_FEATURE": "V", "DISTANCE_RELATED_FLAG": "N", "LOCATION_DESCRIPTOR": null, "BLG_UNIT_TYPE": null, "HSA_FLAG": "N", "HSA_UNIT_ID": null, "BLG_UNIT_PREFIX_1": null, "BLG_UNIT_ID_1": null, "BLG_UNIT_SUFFIX_1": null, "BLG_UNIT_PREFIX_2": null, "BLG_UNIT_ID_2": null, "BLG_UNIT_SUFFIX_2": null, "FLOOR_TYPE": null, "FLOOR_PREFIX_1": null, "FLOOR_NO_1": null, "FLOOR_SUFFIX_1": null, "FLOOR_PREFIX_2": null, "FLOOR_NO_2": null, "FLOOR_SUFFIX_2": null, "BUILDING_NAME": null, "COMPLEX_NAME": null, "HOUSE_PREFIX_1": null, "HOUSE_NUMBER_1": 9.0, "HOUSE_SUFFIX_1": "B", "HOUSE_PREFIX_2": null, "HOUSE_NUMBER_2": 9.0, "HOUSE_SUFFIX_2": "D", "DISP_PREFIX_1": null, "DISP_NUMBER_1": null, "DISP_SUFFIX_1": null, "DISP_PREFIX_2": null, "DISP_NUMBER_2": null, "DISP_SUFFIX_2": null, "ROAD_NAME": "OLSEN", "ROAD_TYPE": "PLACE", "ROAD_SUFFIX": null, "LOCALITY_NAME": "BROADMEADOWS", "LGA_CODE": "333", "STATE": "VIC", "POSTCODE": "3047", "MESH_BLOCK": "20295911000", "NUM_ROAD_ADDRESS": "9B-9D OLSEN PLACE", "NUM_ADDRESS": "9B-9D", "ADDRESS_CLASS": "S", "ADD_ACCESS_TYPE": "L", "OUTSIDE_PROPERTY": "N", "COMPLEX_SITE": "N", "LABEL_ADDRESS": "N", "FEATURE_QUALITY_ID": null, "PFI_CREATED": "2006\/08\/17 00:00:00", "UFI": 461539675.0, "UFI_CREATED": "2008\/07\/23 00:00:00", "UFI_OLD": null }, "geometry": { "type": "Point", "coordinates": [ 144.9268536, -37.6898628 ] } }

  const output = {
    type: 'Feature',
    properties: {
      'addr:housenumber': '9B-9D',
      'addr:street': 'Olsen Place',
      'addr:suburb': 'Broadmeadows',
      'addr:state': 'VIC',
      'addr:postcode': '3047'
    },
    geometry: {
      type: 'Point',
      coordinates: [ 144.9268536, -37.6898628 ]
    }
  }

  t.same(toOSM(input, { includeDerivableProperties: true }), output)
})

test('toOSM range with prefix aX-bY', t => {
  t.plan(1)

  const input = { "type": "Feature", "properties": { "PFI": "427025011", "PROPERTY_PFI": "427025004", "EZI_ADDRESS": "A1-A8 LAKESIDE VILLAGE DRIVE LILYDALE 3140", "SOURCE": "LGU", "SOURCE_VERIFIED": "2017\/10\/11 00:00:00", "IS_PRIMARY": "Y", "PROPERTY_STATUS": "A", "GEOCODE_FEATURE": "E", "DISTANCE_RELATED_FLAG": "N", "LOCATION_DESCRIPTOR": null, "BLG_UNIT_TYPE": null, "HSA_FLAG": "N", "HSA_UNIT_ID": null, "BLG_UNIT_PREFIX_1": null, "BLG_UNIT_ID_1": null, "BLG_UNIT_SUFFIX_1": null, "BLG_UNIT_PREFIX_2": null, "BLG_UNIT_ID_2": null, "BLG_UNIT_SUFFIX_2": null, "FLOOR_TYPE": null, "FLOOR_PREFIX_1": null, "FLOOR_NO_1": null, "FLOOR_SUFFIX_1": null, "FLOOR_PREFIX_2": null, "FLOOR_NO_2": null, "FLOOR_SUFFIX_2": null, "BUILDING_NAME": "STUDENT RESIDENCE - SITE LV 4", "COMPLEX_NAME": "BOX HILL TAFE - LILLYDALE CAMPUS", "HOUSE_PREFIX_1": "A", "HOUSE_NUMBER_1": 1.0, "HOUSE_SUFFIX_1": null, "HOUSE_PREFIX_2": "A", "HOUSE_NUMBER_2": 8.0, "HOUSE_SUFFIX_2": null, "DISP_PREFIX_1": null, "DISP_NUMBER_1": null, "DISP_SUFFIX_1": null, "DISP_PREFIX_2": null, "DISP_NUMBER_2": null, "DISP_SUFFIX_2": null, "ROAD_NAME": "LAKESIDE VILLAGE", "ROAD_TYPE": "DRIVE", "ROAD_SUFFIX": null, "LOCALITY_NAME": "LILYDALE", "LGA_CODE": "377", "STATE": "VIC", "POSTCODE": "3140", "MESH_BLOCK": "20651970000", "NUM_ROAD_ADDRESS": "A1-A8 LAKESIDE VILLAGE DRIVE", "NUM_ADDRESS": "A1-A8", "ADDRESS_CLASS": "S", "ADD_ACCESS_TYPE": "L", "OUTSIDE_PROPERTY": "N", "COMPLEX_SITE": "N", "LABEL_ADDRESS": "N", "FEATURE_QUALITY_ID": "RA_NO_203", "PFI_CREATED": "2017\/10\/11 00:00:00", "UFI": 540188788.0, "UFI_CREATED": "2017\/10\/11 00:00:00", "UFI_OLD": null }, "geometry": { "type": "Point", "coordinates": [ 145.350969, -37.7670618 ] } }

  const output = {
    type: 'Feature',
    properties: {
      'addr:housenumber': 'A1-A8',
      'addr:street': 'Lakeside Village Drive',
      'addr:suburb': 'Lilydale',
      'addr:state': 'VIC',
      'addr:postcode': '3140'
    },
    geometry: {
      type: 'Point',
      coordinates: [ 145.350969, -37.7670618 ]
    }
  }

  t.same(toOSM(input, { includeDerivableProperties: true }), output)
})

test('toOSM basic address schema without derivable properties', t => {
  t.plan(1)

  const input = { "type": "Feature", "properties": { "PFI": "52043942", "PROPERTY_PFI": "602441", "EZI_ADDRESS": "3 BAY ROAD JAM JERRUP 3984", "SOURCE": "LGO", "SOURCE_VERIFIED": "2008\/12\/29 00:00:00", "IS_PRIMARY": "Y", "PROPERTY_STATUS": "A", "GEOCODE_FEATURE": "E", "DISTANCE_RELATED_FLAG": "Y", "LOCATION_DESCRIPTOR": null, "BLG_UNIT_TYPE": null, "HSA_FLAG": "N", "HSA_UNIT_ID": null, "BLG_UNIT_PREFIX_1": null, "BLG_UNIT_ID_1": null, "BLG_UNIT_SUFFIX_1": null, "BLG_UNIT_PREFIX_2": null, "BLG_UNIT_ID_2": null, "BLG_UNIT_SUFFIX_2": null, "FLOOR_TYPE": null, "FLOOR_PREFIX_1": null, "FLOOR_NO_1": null, "FLOOR_SUFFIX_1": null, "FLOOR_PREFIX_2": null, "FLOOR_NO_2": null, "FLOOR_SUFFIX_2": null, "BUILDING_NAME": null, "COMPLEX_NAME": null, "HOUSE_PREFIX_1": null, "HOUSE_NUMBER_1": 3.0, "HOUSE_SUFFIX_1": null, "HOUSE_PREFIX_2": null, "HOUSE_NUMBER_2": null, "HOUSE_SUFFIX_2": null, "DISP_PREFIX_1": null, "DISP_NUMBER_1": null, "DISP_SUFFIX_1": null, "DISP_PREFIX_2": null, "DISP_NUMBER_2": null, "DISP_SUFFIX_2": null, "ROAD_NAME": "BAY", "ROAD_TYPE": "ROAD", "ROAD_SUFFIX": null, "LOCALITY_NAME": "JAM JERRUP", "LGA_CODE": "304", "STATE": "VIC", "POSTCODE": "3984", "MESH_BLOCK": "20034062000", "NUM_ROAD_ADDRESS": "3 BAY ROAD", "NUM_ADDRESS": "3", "ADDRESS_CLASS": "S", "ADD_ACCESS_TYPE": "L", "OUTSIDE_PROPERTY": "N", "COMPLEX_SITE": "N", "LABEL_ADDRESS": "Y", "FEATURE_QUALITY_ID": "RA_NO_208", "PFI_CREATED": null, "UFI": 461425466.0, "UFI_CREATED": "2009\/09\/23 00:00:00", "UFI_OLD": null }, "geometry": { "type": "Point", "coordinates": [ 145.5434286, -38.326053 ] } }

  const output = {
    type: 'Feature',
    properties: {
      'addr:housenumber': '3',
      'addr:street': 'Bay Road'
    },
    geometry: {
      type: 'Point',
      coordinates: [ 145.5434286, -38.326053 ]
    }
  }

  t.same(toOSM(input), output)
})
