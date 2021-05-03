const test = require('tape')

const toOSM = require('../toOSM.js')

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

  t.same(toOSM(input), output)
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

  t.same(toOSM(input), output)
})
