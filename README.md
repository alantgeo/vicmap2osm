# vicmap2osm

Prepares [Vicmap Address](https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap-catalogue/vicmap-address) data for import into OpenStreetMap.

Vicmap Address data © State of Victoria (Department of Environment, Land, Water and Planning), CC BY 4.0, with an [OSMF LWG CC waiver](https://wiki.openstreetmap.org/wiki/File:Vicmap_CCBYPermission_OSM_Final_Jan2018_Ltr.pdf).

## GitLab CI/CD

We use GitLab CI/CD to automate data processing.

The _prepare_ stage downloads Vicmap Address data and converts it into GeoJSON, because this takes around 45 minutes, it's cached through Gitlab for future use, and only needs to be re-run when source Vicmap data changes.

The _build_ stage does all the processing to produce the import candidate data and intermediate datasets and reports.

## Build candidate files (pre-conflation)

Download source Vicmap data and convert to GeoJSON:

    make data/vicmap.geojson

Next, convert into [OSM address schema](https://wiki.openstreetmap.org/wiki/Key:addr), and omit addresses which don't meet our threshold for import (see [_Omitted addresses_](#omitted-addresses)) (code at `bin/vicmap2osm.js`):

    make dist/vicmap-osm.geojson

Next, remove duplicates where all address attributes match at the same location or within a small proximity (code at `bin/reduceDuplicates.js`, see [_Removing duplicates_](#removing-duplicates)):

    make dist/vicmap-osm-uniq.geojson

Two debug outputs are produced from this step.

1. singleCluster - visualises where all addresses with the same address properties are combined into a single "cluster" based on a 25 meter maximum threshold distance. In this case it's safe to reduce all the points into a single centroid point.

2. multiCluster - visualises where all addresses with the same address properties exceed the 25 meter cluster threshold and are unable to be reduced to a single point. These are not included in the import and need to be manually reviewed for manual import.

![multiCluster example](img/reduceDuplicates_multiCluster.png)

Next, reduce some address points with the exact same coordinates but different address attributes (see [_Removing duplicates_](#removing-duplicates) below) (code at `bin/reduceOverlap.js`):

    make dist/vicmap-osm-uniq-flats.geojson

Drop address ranges where the range endpoints are seperatly mapped.

    make dist/vicmap-osm-uniq-flats-withinrange.geojson

### Omitted addresses

Source addresses are omitted:

1. where the address has neither a `addr:housenumber` nor `addr:housename`. Since these addresses have no identifying attribute beyond street, and there is often multiple of these along a street all with the same street/suburb/postcode, they are of little utility and therefore omitted.

2. where, if the address has a building unit type, the building unit type must match a whitelisted type. For example this includes unit and shop numbers but excludes things like car space numbers.

These rules are defined in `filterOSM.js` and `filterSource.js`.

#### Duplicates through mixed range/individual points

Some addresses appear as both a range and individual points. For example one address as `1-5` but additional addresses as `1`, `3` and `5`.

Where the endpoints of the range match existing non-range address points, and where the unit value is the same, and where the individual points have different geometries the range address is dropped in favour of the indivdiual points.

Where the individual points share the same geometry as each other, then the range is favoured and the individual points are dropped.

### OSM schema

- `addr:unit` is constructed either as a single value or range where the building unit is supplied
- `addr:housename` is included where there is a building name present in the source
- `addr:housenumber` is constructed from with the number prefix, main number and number suffix fields for each of the from/to range, eg `1A-3B`.
- `addr:street` is constructed from the street proper name, street type and street suffix, formatted as capital case. eg `Main Street North`.
- `addr:suburb` is constructed from the locality value formatted as capital case.
- `addr:postcode` is as supplied.
- `addr:state` is as supplied and should always be `VIC`.

The schema mapping mostly happens in `toOSM.js`.

### Removing duplicates

Source address data contains many address points overlapping or within a close proximity.

1. Where all the OSM tags are the same, and the points have the exact same geometry within a close proximity, all the duplicates are omitted and the centroid location is used. This happens in `bin/reduceDuplicates.js` during `make dist/vicmap-osm-uniq.geojson`.

![reduceDuplicates in action](img/reduceDuplicates_singleCluster.png)

2. Where each of the housenumber, street, suburb, postcode, state are the same for each of the strictly overlapping points, but only the unit value differs we attempt to reduce these to a single address point without `addr:unit` but instead using [`addr:flats`](https://wiki.openstreetmap.org/wiki/Key:addr:flats).

`addr:flats` is the documented tag for describing the unit numbers at an address.

In the real world where you have different unit numbers for townhouses or villas ideally you'd have different addresses in OSM using `addr:unit` but have each located on each dwelling.

Where you have an apartment building containing multiple units, this import chooses to avoid ovelapping addresses each with a different `addr:unit` instead creating a single node with `addr:flats`.

Where possible, unit numbers are reduced to ranges, for example to create `addr:flats=1-5;10-15;20` instead of `addr:flats=1;2;3;4;5;10;11;12;13;14;15;20`.

Multiple points overlapping don't add any extra value to the OSM data and are are harder for mappers to manage, especially for large apartment buildings.

Data consumers can still easily explode `addr:flats` out into overlapping nodes with varying `addr:unit` if desired.

### null values

Values `UNNAMED` and `NOT NAMED` appear as street name and locality names. These values are treated as null/empty values rather than proper names.

### name
Source data contains a field for building / property name. This appears to be a mixed bag sometimes it might fit better as `addr:housename` othertimes simply `name`. Further it's not too clear the distinction between these tags and how house names, property names, building names or the name of the venue at the site should be tagged.

It's common for the source data to use what we'd consider a description like "Shop", "Public Toilets" or "Reserve".

For these reasons this building / property name is not included, however it could be a useful point of reference for mappers considering manually adding this data at a later stage.

### Complex Name
Source data sometimes includes a complex name, for example _CHADSTONE SHOPPING CENTRE_ or _MELBOURNE UNIVERSITY_. These attributes are not used as these names should appear on the actual feature like `shop=mall` or `amenity=university`.

They might be of interest for mappers as an additional data source, externally to this import.

### Display Address
Source data has a display address which can differ from the official address. For example if a building is `1-3` but is signed as simply `1`. Currently we ignore the display address, and while this can be seen as more correct based on the "official" address, does it go against the OSM principle of mapping what's on the ground?

### Unit Type
Unit values have a designator set eg "UNIT 1", "SHOP 1", "SUITE 1", etc.

The `addr:unit` tag expects the value, "1" from the given examples, not a full string like "UNIT 1", so we don't include this designator in the `addr:unit` value.

One potential solution is to encode this in the `addr:` key like `addr:unit`, `addr:shop`, `addr:suite`, however these can still all be considered "units" so this is not preferred.

Another solution is use a new tag like `addr:unit:prefix=Unit`, although there is no existing usage of this tagging scheme ([taginfo](https://taginfo.openstreetmap.org/search?q=addr%3Aunit#keys)).

In the current codebase this information is omitted.
