# vicmap2osm

Prepares [Vicmap Address](https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap-catalogue/vicmap-address) data for import into OpenStreetMap.

Vicmap Address data © State of Victoria (Department of Environment, Land, Water and Planning), CC BY 4.0, with an [OSMF LWG CC waiver](https://wiki.openstreetmap.org/wiki/File:Vicmap_CCBYPermission_OSM_Final_Jan2018_Ltr.pdf).

## GitLab CI/CD

GitLab CI/CD automates data process in 

The _prepare_ stage downloads Vicmap Address data and converts it into GeoJSON, because this takes around 45 minutes, it's cached through CI/CD for future use.

The _build_ stage does all the processing to produce the import candidate data and intermediate datasets and reports.

## Build candidate files

Download source Vicmap data and convert to GeoJSON:

   make data/vicmap.geojson

Convert into OSM address schema, and omit addresses which don't meet our threshold for import (see _Omitted addresses_ below) (code at `bin/vicmap2osm.js`):

    make dist/vicmap-osm.geojson

Remove duplicates where all address attributes match at the same location or within a small proximity (code at `bin/reduceDuplicates.js`):

    make dist/vicmap-osm-uniq.geojson

Reduce some address points with the same coordinates but different address attributes (see _Overlapping points_ below) (code at `bin/reduceOverlap.js`):

    make dist/vicmap-osm-flats.geojson

This is only done for strictly overlapping points, where the geometry varies slightly then that's okay we don't attempt to combine.

### Omitted addresses

Source addresses are omitted where they:

1. have neither a `addr:housenumber` nor `addr:housename`.

Since these addresses have no identifying attribute beyond street, and there is often multiple of these along a street all with the same street/suburb/postcode, they are of little utility and therefore omitted.

These rules are defined in `filterOSM.js`.

### OSM schema

- `addr:unit` is constructed either as a single value or range where the building unit is supplied
- `addr:housename` is included where there is a building name present in the source
- `addr:housenumber` is constructed from with the number prefix, main number and number suffix fields for each of the from/to range, eg `1A-3B`.
- `addr:street` is constructed from the street proper name, street type and street suffix, formatted as capital case. eg `Main Street North`.
- `addr:suburb` is constructed from the locality value formatted as capital case.
- `addr:postcode` is as supplied.
- `addr:state` is as supplied and should always be `VIC`.

The schema mapping mostly happens in `toOSM.js`.

### Overlapping points

Source address data contains many address points overlapping.

1. First pass, where all the OSM tags are the same, and the points have the exact same geometry, all the duplicates are omitted.

Where each of the housenumber, street, suburb, postcode, state are the same for each of the overlapping points, but only the unit value differs we attempt to reduce these to a single address point without `addr:unit` but instead using [`addr:flats`](https://wiki.openstreetmap.org/wiki/Key:addr:flats).

`addr:flats` is the documented tag for describing the unit numbers at an address.

In the real world where you have different unit numbers for townhouses or villas ideally you'd have different addresses in OSM using `addr:unit` but have each located on each dwelling.

Where you have an apartment building containing multiple units, this import chooses to avoid ovelapping addresses each with a different `addr:unit` instead creating a single node with `addr:flats`.

Where possible, unit numbers are reduced to ranges, for example to create `addr:flats=1-5;10-15;20` instead of `addr:flats=1;2;3;4;5;10;11;12;13;14;15;20`.

Multiple points overlapping don't add any extra value to the OSM data and are are harder for mappers to manage, especially for large appartment buildings.

Data consumers can still easily explode `addr:flats` out into overlapping nodes with varying `addr:unit` if desired.

### null values

Values `UNNAMED` and `NOT NAMED` appear as street name and locality names. These values are treated as null/empty values rather than proper names.