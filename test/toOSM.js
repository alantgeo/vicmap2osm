const test = require('tape')

const toOSM = require('../lib/toOSM.js')

test('toOSM basic address schema', t => {
  t.plan(1)

  const input = { "type": "Feature", "properties": { "PFI": "52043942", "PR_PFI": "602441", "EZI_ADD": "3 BAY ROAD JAM JERRUP 3984", "SOURCE": "LGO", "SRC_VERIF": "2008-12-29", "IS_PRIMARY": "Y", "PROPSTATUS": "A", "GCODEFEAT": "E", "DIST_FLAG": "Y", "LOC_DESC": null, "BLGUNTTYP": null, "HSA_FLAG": "N", "HSAUNITID": null, "BUNIT_PRE1": null, "BUNIT_ID1": 0, "BUNIT_SUF1": null, "BUNIT_PRE2": null, "BUNIT_ID2": 0, "BUNIT_SUF2": null, "FLOOR_TYPE": null, "FL_PREF1": null, "FLOOR_NO_1": 0, "FL_SUF1": null, "FL_PREF2": null, "FLOOR_NO_2": 0, "FL_SUF2": null, "BUILDING": null, "COMPLEX": null, "HSE_PREF1": null, "HSE_NUM1": 3, "HSE_SUF1": null, "HSE_PREF2": null, "HSE_NUM2": 0, "HSE_SUF2": null, "DISP_PREF1": null, "DISP_NUM1": 0, "DISP_SUF1": null, "DISP_PREF2": null, "DISP_NUM2": 0, "DISP_SUF2": null, "ROAD_NAME": "BAY", "ROAD_TYPE": "ROAD", "RD_SUF": null, "LOCALITY": "JAM JERRUP", "LGA_CODE": "304", "STATE": "VIC", "POSTCODE": "3984", "MESH_BLOCK": "20034062000", "NUM_RD_ADD": "3 BAY ROAD", "NUM_ADD": "3", "ADD_CLASS": "S", "ACCESSTYPE": "L", "OUT_PROP": "N", "COMPLXSITE": "N", "LABEL_ADD": "Y", "FQID": "RA_NO_208", "UFI": 461425466, "UFI_CR": "2009-09-23", "UFI_OLD": 0 }, "geometry": { "type": "Point", "coordinates": [ 145.5434286, -38.326053 ] } }

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

  const input = { "type": "Feature", "properties": { "PFI": "212027680", "PR_PFI": "212027679", "EZI_ADD": "24A FORESHORE ROAD JAM JERRUP 3984", "SOURCE": "LGO", "SRC_VERIF": "2009-01-05", "IS_PRIMARY": "Y", "PROPSTATUS": "A", "GCODEFEAT": "V", "DIST_FLAG": "N", "LOC_DESC": null, "BLGUNTTYP": null, "HSA_FLAG": "N", "HSAUNITID": null, "BUNIT_PRE1": null, "BUNIT_ID1": 0, "BUNIT_SUF1": null, "BUNIT_PRE2": null, "BUNIT_ID2": 0, "BUNIT_SUF2": null, "FLOOR_TYPE": null, "FL_PREF1": null, "FLOOR_NO_1": 0, "FL_SUF1": null, "FL_PREF2": null, "FLOOR_NO_2": 0, "FL_SUF2": null, "BUILDING": null, "COMPLEX": null, "HSE_PREF1": null, "HSE_NUM1": 24, "HSE_SUF1": "A", "HSE_PREF2": null, "HSE_NUM2": 0, "HSE_SUF2": null, "DISP_PREF1": null, "DISP_NUM1": 0, "DISP_SUF1": null, "DISP_PREF2": null, "DISP_NUM2": 0, "DISP_SUF2": null, "ROAD_NAME": "FORESHORE", "ROAD_TYPE": "ROAD", "RD_SUF": null, "LOCALITY": "JAM JERRUP", "LGA_CODE": "304", "STATE": "VIC", "POSTCODE": "3984", "MESH_BLOCK": "20034980000", "NUM_RD_ADD": "24A FORESHORE ROAD", "NUM_ADD": "24A", "ADD_CLASS": "S", "ACCESSTYPE": "L", "OUT_PROP": "N", "COMPLXSITE": "N", "LABEL_ADD": "Y", "FQID": null, "PFI_CR": "2008-11-06", "UFI": 462075378, "UFI_CR": "2009-09-23", "UFI_OLD": 0 }, "geometry": { "type": "Point", "coordinates": [ 145.5171569, -38.3251239 ] } }

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

  const input = { "type": "Feature", "properties": { "PFI": "51988731", "PR_PFI": "910693", "EZI_ADD": "29-47 HILLMARTIN LANE DIAMOND CREEK 3089", "SOURCE": "LGO", "SRC_VERIF": "2010-01-13", "IS_PRIMARY": "Y", "PROPSTATUS": "A", "GCODEFEAT": "V", "DIST_FLAG": "N", "LOC_DESC": null, "BLGUNTTYP": null, "HSA_FLAG": "N", "HSAUNITID": null, "BUNIT_PRE1": null, "BUNIT_ID1": 0, "BUNIT_SUF1": null, "BUNIT_PRE2": null, "BUNIT_ID2": 0, "BUNIT_SUF2": null, "FLOOR_TYPE": null, "FL_PREF1": null, "FLOOR_NO_1": 0, "FL_SUF1": null, "FL_PREF2": null, "FLOOR_NO_2": 0, "FL_SUF2": null, "BUILDING": null, "COMPLEX": null, "HSE_PREF1": null, "HSE_NUM1": 29, "HSE_SUF1": null, "HSE_PREF2": null, "HSE_NUM2": 47, "HSE_SUF2": null, "DISP_PREF1": null, "DISP_NUM1": 0, "DISP_SUF1": null, "DISP_PREF2": null, "DISP_NUM2": 0, "DISP_SUF2": null, "ROAD_NAME": "HILLMARTIN", "ROAD_TYPE": "LANE", "RD_SUF": null, "LOCALITY": "DIAMOND CREEK", "LGA_CODE": "356", "STATE": "VIC", "POSTCODE": "3089", "MESH_BLOCK": "20515970000", "NUM_RD_ADD": "29-47 HILLMARTIN LANE", "NUM_ADD": "29-47", "ADD_CLASS": "S", "ACCESSTYPE": "L", "OUT_PROP": "N", "COMPLXSITE": "N", "LABEL_ADD": "Y", "FQID": null, "UFI": 461284870, "UFI_CR": "2008-07-23", "UFI_OLD": 0 }, "geometry": { "type": "Point", "coordinates": [ 145.1361835, -37.6704745 ] } }

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
      coordinates: [ 145.1361835, -37.6704745 ]
    }
  }

  t.same(toOSM(input, { includeDerivableProperties: true }), output)
})

test('toOSM range with suffix Xa-Yb', t => {
  t.plan(1)

  const input = { "type": "Feature", "properties": { "PFI": "207999843", "PR_PFI": "207999842", "EZI_ADD": "9B-9D OLSEN PLACE BROADMEADOWS 3047", "SOURCE": "LGO", "SRC_VERIF": "2009-01-21", "IS_PRIMARY": "Y", "PROPSTATUS": "A", "GCODEFEAT": "V", "DIST_FLAG": "N", "LOC_DESC": null, "BLGUNTTYP": null, "HSA_FLAG": "N", "HSAUNITID": null, "BUNIT_PRE1": null, "BUNIT_ID1": 0, "BUNIT_SUF1": null, "BUNIT_PRE2": null, "BUNIT_ID2": 0, "BUNIT_SUF2": null, "FLOOR_TYPE": null, "FL_PREF1": null, "FLOOR_NO_1": 0, "FL_SUF1": null, "FL_PREF2": null, "FLOOR_NO_2": 0, "FL_SUF2": null, "BUILDING": null, "COMPLEX": null, "HSE_PREF1": null, "HSE_NUM1": 9, "HSE_SUF1": "B", "HSE_PREF2": null, "HSE_NUM2": 9, "HSE_SUF2": "D", "DISP_PREF1": null, "DISP_NUM1": 0, "DISP_SUF1": null, "DISP_PREF2": null, "DISP_NUM2": 0, "DISP_SUF2": null, "ROAD_NAME": "OLSEN", "ROAD_TYPE": "PLACE", "RD_SUF": null, "LOCALITY": "BROADMEADOWS", "LGA_CODE": "333", "STATE": "VIC", "POSTCODE": "3047", "MESH_BLOCK": "20295911000", "NUM_RD_ADD": "9B-9D OLSEN PLACE", "NUM_ADD": "9B-9D", "ADD_CLASS": "S", "ACCESSTYPE": "L", "OUT_PROP": "N", "COMPLXSITE": "N", "LABEL_ADD": "N", "FQID": null, "PFI_CR": "2006-08-17", "UFI": 461539675, "UFI_CR": "2008-07-23", "UFI_OLD": 0 }, "geometry": { "type": "Point", "coordinates": [ 144.9268536, -37.6898628 ] } }

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

  const input = { "type": "Feature", "properties": { "PFI": "427025011", "PR_PFI": "427025004", "EZI_ADD": "A1-A8 LAKESIDE VILLAGE DRIVE LILYDALE 3140", "SOURCE": "LGU", "SRC_VERIF": "2017-10-11", "IS_PRIMARY": "Y", "PROPSTATUS": "A", "GCODEFEAT": "E", "DIST_FLAG": "N", "LOC_DESC": null, "BLGUNTTYP": null, "HSA_FLAG": "N", "HSAUNITID": null, "BUNIT_PRE1": null, "BUNIT_ID1": 0, "BUNIT_SUF1": null, "BUNIT_PRE2": null, "BUNIT_ID2": 0, "BUNIT_SUF2": null, "FLOOR_TYPE": null, "FL_PREF1": null, "FLOOR_NO_1": 0, "FL_SUF1": null, "FL_PREF2": null, "FLOOR_NO_2": 0, "FL_SUF2": null, "BUILDING": "STUDENT RESIDENCE - SITE LV 4", "COMPLEX": "BOX HILL TAFE - LILLYDALE CAMPUS", "HSE_PREF1": "A", "HSE_NUM1": 1, "HSE_SUF1": null, "HSE_PREF2": "A", "HSE_NUM2": 8, "HSE_SUF2": null, "DISP_PREF1": null, "DISP_NUM1": 0, "DISP_SUF1": null, "DISP_PREF2": null, "DISP_NUM2": 0, "DISP_SUF2": null, "ROAD_NAME": "LAKESIDE VILLAGE", "ROAD_TYPE": "DRIVE", "RD_SUF": null, "LOCALITY": "LILYDALE", "LGA_CODE": "377", "STATE": "VIC", "POSTCODE": "3140", "MESH_BLOCK": "20651970000", "NUM_RD_ADD": "A1-A8 LAKESIDE VILLAGE DRIVE", "NUM_ADD": "A1-A8", "ADD_CLASS": "S", "ACCESSTYPE": "L", "OUT_PROP": "N", "COMPLXSITE": "N", "LABEL_ADD": "N", "FQID": "RA_NO_203", "PFI_CR": "2017-10-11", "UFI": 540188788, "UFI_CR": "2017-10-11", "UFI_OLD": 0 }, "geometry": { "type": "Point", "coordinates": [ 145.350969, -37.7670618 ] } }

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

  const input = { "type": "Feature", "properties": { "PFI": "52043942", "PR_PFI": "602441", "EZI_ADD": "3 BAY ROAD JAM JERRUP 3984", "SOURCE": "LGO", "SRC_VERIF": "2008-12-29", "IS_PRIMARY": "Y", "PROPSTATUS": "A", "GCODEFEAT": "E", "DIST_FLAG": "Y", "LOC_DESC": null, "BLGUNTTYP": null, "HSA_FLAG": "N", "HSAUNITID": null, "BUNIT_PRE1": null, "BUNIT_ID1": 0, "BUNIT_SUF1": null, "BUNIT_PRE2": null, "BUNIT_ID2": 0, "BUNIT_SUF2": null, "FLOOR_TYPE": null, "FL_PREF1": null, "FLOOR_NO_1": 0, "FL_SUF1": null, "FL_PREF2": null, "FLOOR_NO_2": 0, "FL_SUF2": null, "BUILDING": null, "COMPLEX": null, "HSE_PREF1": null, "HSE_NUM1": 3, "HSE_SUF1": null, "HSE_PREF2": null, "HSE_NUM2": 0, "HSE_SUF2": null, "DISP_PREF1": null, "DISP_NUM1": 0, "DISP_SUF1": null, "DISP_PREF2": null, "DISP_NUM2": 0, "DISP_SUF2": null, "ROAD_NAME": "BAY", "ROAD_TYPE": "ROAD", "RD_SUF": null, "LOCALITY": "JAM JERRUP", "LGA_CODE": "304", "STATE": "VIC", "POSTCODE": "3984", "MESH_BLOCK": "20034062000", "NUM_RD_ADD": "3 BAY ROAD", "NUM_ADD": "3", "ADD_CLASS": "S", "ACCESSTYPE": "L", "OUT_PROP": "N", "COMPLXSITE": "N", "LABEL_ADD": "Y", "FQID": "RA_NO_208", "UFI": 461425466, "UFI_CR": "2009-09-23", "UFI_OLD": 0 }, "geometry": { "type": "Point", "coordinates": [ 145.5434286, -38.326053 ] } }

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
