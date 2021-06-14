# vicmap2osm

Prepares [Vicmap Address](https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap-catalogue/vicmap-address) data for [import](https://wiki.openstreetmap.org/wiki/Import/Guidelines) into OpenStreetMap.

Vicmap Address data © State of Victoria (Department of Environment, Land, Water and Planning), CC BY 4.0, with an [OSMF LWG CC waiver](https://wiki.openstreetmap.org/wiki/File:Vicmap_CCBYPermission_OSM_Final_Jan2018_Ltr.pdf).

This import proposal has been supported by the National Heavy Vehicle Regulator (NHVR).

The mandatory OSM wiki documentation of this import is at [https://wiki.openstreetmap.org/wiki/Vicmap_Address](https://wiki.openstreetmap.org/wiki/Vicmap_Address).

## GitLab CI/CD

We use GitLab CI/CD to automate data processing.

- _prepare_ stage downloads Vicmap Address data and converts it into GeoJSON, because this takes around 45 minutes, it's cached through Gitlab for future use, and only needs to be re-run when source Vicmap data changes.

- _build vicmap_ stage converts Vicmap data into OSM ready data.

- _build osm_ stage downloads existing OSM address data and prepares it for conflation with Vicmap data.

- _conflate_ takes the Vicmap OSM ready data and existing OSM address data from the _build_ stage and conflates the two into import candidates.

## Build candidate files (pre-conflation)

Download source Vicmap data (_prepare_ stage):

    data/vicmap/ll_gda94/sde_shape/whole/VIC/VMADD/layer/address.shp

Convert to GeoJSON (_prepare_ stage):

    make data/vicmap.geojson

The following steps are built into the _build vicmap_ stage.

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

Three debug outputs are produced from this step.

1. multipleNonUnit
2. oneUnitOneNonUnit - where there is one address without a unit and one with a unit at the same point, with all the same address attributes except unit. In this case we just drop the non-unit address and keep the addr:unit one.
3. sameGeometry

Next, drop address ranges where the range endpoints are separately mapped (see [_Duplicates through mixed range and points_](#duplicates-through-mixed-range-and-points) below) (code at `bin/reduceRangeDuplicates.js`).

    make dist/vicmap-osm-uniq-flats-withinrange.geojson

Even if we are lacking the intermediate address points within the range, we still drop the range as software can interpolate intermediate addresses from the two endpoints.

### Omitted addresses

Source addresses are omitted:

1. where the address has neither a `addr:housenumber` nor `addr:housename`. Since these addresses have no identifying attribute beyond street, and there are often multiple of these along a street all with the same street/suburb/postcode, they are of little utility and therefore omitted.

2. where, if the address has a building unit type, the building unit type must match a whitelisted type. For example this includes unit and shop numbers but excludes things like car space numbers.

These rules are defined in `lib/filterOSM.js` and `lib/filterSource.js`.

#### Duplicates through mixed range and points

Some addresses appear as both a range and individual points. For example one address as `1-5` but additional addresses as `1`, `3` and `5`.

Where the endpoints of the range match existing non-range address points, and where the unit value is the same, and where the individual points have different geometries the range address is dropped in favour of the individual points.

Where the individual points share the same geometry as each other, then the range is favoured and the individual points are dropped.

### OSM schema

- `addr:unit` is constructed either as a single value or range where the building unit is supplied
- `addr:housename` is included where there is a building name present in the source
- `addr:housenumber` is constructed from with the number prefix, main number and number suffix fields for each of the from/to range, eg `1A-3B`.
- `addr:street` is constructed from the street proper name, street type and street suffix, formatted as capital case. eg `Main Street North`.

The following tags were originally coded to support, but are currently set to be excluded, see section below.

- `addr:suburb` is constructed from the locality value formatted as capital case.
- `addr:postcode` is as supplied.
- `addr:state` is as supplied and should always be `VIC`.

The schema mapping mostly happens in `lib/toOSM.js`.

### addr:suburb

Vicmap locality data sometimes includes a suffix placename to a locality for example:

 - Hillside Greater Melbourne
 - Hillside Bairnsdale

These are converted into simply "Hillside", the full list of special cases is in `lib/toOSM.js`.

### Inclusion of `addr:suburb`, `addr:postcode` and `addr:state`
Some within the OSM community advocate including full address attributes `addr:suburb`, `addr:postcode`, `addr:state` on all address objects even when they can be derived from a `boundary` object already mapped. Others advocate excluding these attributes from each address object where they can be derived from the `boundary` object.

I undertook analysis (see `bin/compareSuburb.js` and the _build compareSuburb_ stage) to see how consistent Vicmap `addr:suburb` was with OSM `admin_level=10` boundaries and `addr:postcode` with a potential `postal_code` tag on each OSM level 10 boundary.

After excluding some special cases, there were 62 Vicmap addresses with a reported suburb/locality different to what would be derived from the OSM admin boundary. It looks like a bunch are bad Vicmap data, most of the rest are address points practically on the admin boundary line, there's only a [small handful otherwise to deal with](https://gitlab.com/alantgeo/vicmap2osm/-/jobs/1279647817/artifacts/raw/dist/vicmapSuburbDiffersWithOSM.geojson).

This analysis supports it is mostly fine from a data consistency point of view to rely on the `admin_level=10` suburb, except for a handful of cases (and even then it's not clear between Vicmap or OSM which is correct).

For postcodes, of the 2988 `admin_level=10` suburb/localities in OSM:

- 2912 have only one distinct postcode from Vicmap data,
- 9 have >1 postcode from Vicmap
- a handful have no addresses

Of the 9 that have >1 postcode, 7 have only 1 address with a different postcode, 1 has only 3 addresses with a different postcode, and one suburb/locality (Melbourne suburb) has two main postcodes 3000 with 51,458 addresses and postcode 3004 with 12,158 postcodes. In the Melbourne suburb, it's clear that the Melbourne CBD is 3000 and areas south of the Yarra River are 3004 (see img/postcodes_melbourne.png). A separate `boundary=postal_code` already exists for [3000](https://www.openstreetmap.org/relation/8383583) and [3004](https://www.openstreetmap.org/relation/3402721).

My analysis supports adding `postal_code` to the level 10 admin boundary is safe for pretty much the whole state, except for Melbourne where `postal_code` boundaries [have already been mapped](https://overpass-turbo.eu/s/18eS) (`boundary=postal_code in "VIC, AU"`).

At the time of writing 360 `admin_level=10` boundaries have a `postal_code` tag [see map](https://overpass-turbo.eu/s/18eU) (`(type=boundary and boundary=administrative and admin_level=10 and postal_code=*) in "VIC, AU"`), 2613 `admin_level=10` boundaries don't have a `postal_code` tag [see map](https://overpass-turbo.eu/s/18eV) (`(type=boundary and boundary=administrative and admin_level=10 and postal_code is null) in "VIC, AU"`).

As part of this import, `postal_code` will be added to `admin_level=10` boundaries derived from Vicmap, see XXX.

After lengthy engagement with the local community, we opt to omit these tags in the current import.

### Removing duplicates

Source address data contains many address points overlapping or within a close proximity.

1. Where all the OSM tags are the same, and the points have the exact same geometry within a close proximity, all the duplicates are omitted and the centroid location is used. This happens in `bin/reduceDuplicates.js` during `make dist/vicmap-osm-uniq.geojson`.

![reduceDuplicates in action](img/reduceDuplicates_singleCluster.png)

2. Where each of the housenumber, street (previously also including suburb, postcode, state) are the same for each of the strictly overlapping points, but only the unit value differs we attempt to reduce these to a single address point without `addr:unit` but instead using [`addr:flats`](https://wiki.openstreetmap.org/wiki/Key:addr:flats).

`addr:flats` is the documented tag for describing the unit numbers at an address.

In the real world where you have different unit numbers for townhouses or villas ideally you'd have different addresses in OSM using `addr:unit` but have each located on each dwelling.

Where you have an apartment building containing multiple units, this import chooses to avoid overlapping addresses each with a different `addr:unit` instead creating a single node with `addr:flats`.

Where possible, unit numbers are reduced to ranges, for example to create `addr:flats=1-5;10-15;20` instead of `addr:flats=1;2;3;4;5;10;11;12;13;14;15;20`.

Multiple points overlapping don't add any extra value to the OSM data and are are harder for mappers to manage, especially for large apartment buildings.

Data consumers can still easily explode `addr:flats` out into overlapping nodes with varying `addr:unit` if desired.

Because OSM tag values are limited to 255 characters, if the constructed `addr:flats` exceeds this it is split across `addr:flats`, `addr:flats1`, etc. While not ideal I don't see any other option.

### null values

Values `UNNAMED` and `NOT NAMED` appear as street name and locality names. These values are treated as null/empty values rather than proper names.

### Building Name
Source data contains a field for building / property name. This appears to be a mixed bag sometimes it might fit better as `addr:housename` other times simply `name`. Further it's not too clear the distinction between these tags and how house names, property names, building names or the name of the venue at the site should be tagged or even which type of name it should be.

It's common for the source data to use what we'd consider a description like "Shop", "Public Toilets" or "Reserve" instead of a proper name.

There are about 40,000 of these names.

So while there is value including property names, building names, farm names as part of the address, since we can't do this reliably, the building / property name is not included in this import, however it could be a useful point of reference for mappers considering manually adding this data at a later stage.

`bin/vicmap2osm.js` outputs `dist/vicmap-building.geojson` which contains all the building name features.

The script at `bin/building.js` tests to see whether this building / property name is matching a nearby OSM object.

This outputs a bunch of files into `dist/vicmap-building-conflation` including, three MapRoulette challenges:

- `mr_singleNearbySimilarFeature` - the Vicmap building name matched a single nearby OSM feature (but the name wasn't an exact match, where it was an exact match the Vicmap building name is not flagged for inclusion in MapRoulette)
- `mr_multipleNearbySimilarFeatures` - the Vicmap building name matched multiple nearby OSM features
- `mr_noNearbySimilarFeature` - the Vicmap building name didn't match any nearby OSM features

This is built into the _conflate_ stage.

### Complex Name
Source data sometimes includes a complex name, for example _CHADSTONE SHOPPING CENTRE_ or _MELBOURNE UNIVERSITY_. These attributes are not used as these names should appear on the actual feature like `shop=mall` or `amenity=university`.

While there is ~55,000 Vicmap points with a complex name, there are only ~2000 uniq names.

`bin/vicmap2osm.js` outputs `dist/vicmap-complex.geojson` which contains all the complex name features.

The script at `bin/complex.js` processes this to:

- Group nearby complex features with the same name into a single centroid point
- Tests to see whether this complex name is matching a nearby OSM object
- Where it doesn't find a match in OSM, then it outputs a MapRoulette data file for mappers to review and potentially add these complex names to OSM.

This outputs a bunch of files into `dist/vicmap-complex-conflation` including, three MapRoulette challenges:

- `mr_singleNearbySimilarFeature` - the Vicmap complex matched a single nearby OSM feature (but the name wasn't an exact match, where it was an exact match the Vicmap complex is not flagged for inclusion in MapRoulette)
- `mr_multipleNearbySimilarFeatures` - the Vicmap complex matched multiple nearby OSM features
- `mr_noNearbySimilarFeature` - the Vicmap complex didn't match any nearby OSM features

This is built into the _conflate_ stage.

### Display Address
Source data has a display address which can differ from the official address. For example if a building is `1-3` but is signed as simply `1`. Currently we ignore the display address, and while this can be seen as more correct based on the "official" address, does it go against the OSM principle of mapping what's on the ground?

### Unit Type
Unit values have a designator set eg "UNIT 1", "SHOP 1", "SUITE 1", etc.

The `addr:unit` tag expects the value, "1" from the given examples, not a full string like "UNIT 1", so we don't include this designator in the `addr:unit` value.

One potential solution is to encode this in the `addr:` key like `addr:unit`, `addr:shop`, `addr:suite`, however these can still all be considered "units" so this is not preferred.

Another solution is use a new tag like `addr:unit:prefix=Unit`, although there is no existing usage of this tagging scheme ([taginfo](https://taginfo.openstreetmap.org/search?q=addr%3Aunit#keys)).

In the current codebase this information about the unit type is omitted (the unit value is retained).

### Why no Vicmap ID?
Vicmap data has two native IDs,

- PFI (Persistent Feature Identifier) - "The unique code provides at creation of the feature which remains until the feature is retired."
- UFI (Unique Feature Identifier) - "Each feature is uniquely identified and renewed with each change."

Though neither of these are included in the OSM tags when imported. This was a conscious decision not because,

- When an OSM mapper is confronted by an address with this ID, it's unclear what they should do with it when making changes. eg, if they notice the number is wrong, or the street is wrong and they update it in OSM, is this ID still valid? Is it still the same address in OSM and Vicmap?
- We want these imported addresses to be organic OSM data freely updated by mappers and not seen as untouchable data, an ID makes it look like it's not organic OSM data and a mapper might choose to just leave it as is even if it doesn't match what's on the ground.

### Where should addresses exist?

In OSM addresses might be found in any of these mapping styles in any combination:

1. `addr:*` keys on a building object [example](https://www.openstreetmap.org/way/222891745)
2. `addr:*` keys on a lone node without any other non-address tags [example](https://www.openstreetmap.org/node/2024786354)
3. `addr:interpolation` on a linear way [example](https://www.openstreetmap.org/way/196467381)
4. `addr:*` keys on an another object like `amenity`, `shop`, `office`, etc. which could be a node, way or relation [example](https://www.openstreetmap.org/node/1975940442)

For this import, where the address doesn't already exist, then it will be added as a new lone node, not attached to any existing building or any existing object. Local mappers can choose to merge these tags into an existing building, or into an object (subject to local knowledge or survey).

Where the address does already exist, but is missing some `addr:*` tags, the new tags are added into the existing object.

## Conflation with existing OSM address data
Given some addresses are already mapped in OSM we first break the state down into city blocks. Where a block contains no addresses in OSM then we consider it low risk to automatically import all address in the block. The only risk is the address in either OSM or the source data is in the wrong block, but this is less likely and would be hard to detect otherwise.

Where there contains some addresses already in OSM for the block, then it will either need further conflation or need to be manually reviewed prior to importing.

Generate the latest view of address data in OSM:

    make data/victoria-addr.osm.fgb
    make data/victoria-addr.osm.centroids.fgb

Generate city blocks:

    make data/blocks.fgb

Sort blocks into containing some OSM addresses or containing no OSM addresses:

    make dist/blocksByOSMAddr.fgb

Conflate Vicmap addresses with OSM:

    make dist/conflate

This produces outputs in `dist/conflate`:

1. `noOSMAddressWithinBlock` - where no OSM addresses were found within the block, then any Vicmap addresses within this block are placed in this output. These are considered good for bulk import.
2. `withinExistingOSMAddressPoly` - where the candidate Vicmap address was found inside an existing address polygon from OSM. These should be reviewed for import.
3. `notFoundInBlocks` - some areas of the state didn't have blocks created, particularly in the coastal region, so these are handled manually.
4. `exactMatch` - `addr:housenumber` and `addr:street` match an existing address within the same block. These should be reviewed for import.
5. `noExactMatch` - the Vicmap addresses exists within a block with existing OSM addresses, however no exact match on the `addr:housenumber` and `addr:street` was found. This likely can be imported automatically, but may want to be manually reviewed.

Some addresses in OSM are mapped with `addr:housenumber=unit/number`, in the conflation process where matched with a corresponding unit/number/street, then the OSM address is modified into `addr:unit=unit`, `addr:housenumber=number`.

This is outputted as a MapRoulette challenge (`dist/conflate/mr_explodeUnitFromNumber.geojson`), however because we are confident in this change it isn't uploaded into MapRoulette, instead we further process this and upload it as `addrUnitFromHousenumber` in the import candidates.

These results are in GeoJSON format, for easier viewing in QGIS convert to FGB with:

    make convertConflationResultsToFGB

Further processing to conflate Vicmap complex and building names with OSM can be done via:

    make data/victoria-named-features.osm.geojson
    make dist/vicmap-complex-conflation
    make dist/vicmap-building-conflation

These outputs are described in the [Building Name](#building-name) and [Complex Name](#complex-name) sections.

- [ ] we need to deal with addresses represented in OSM as interpolation ways. If there is community consensus to replace these existing interpolation ways with individual point nodes or leave the existing interpolation ways.
- [ ] we need a better way to review matches where some attributes differ, potentially as a quick fix MapRoulette for tricky cases, or done as a bulk import for easy cases (eg. simply adding `addr:suburb`, `addr:state` and `addr:postcode`)

## Prepare Final Import Candidates

After conflation, import candidate .osm files are produced with

    make dist/candidates

Split into the following candidate categories, then again split into suburb/locality (`admin_level=10`).

### Candidate Categories
1. `newAddressesWithoutConflicts` - new addresses from Vicmap where it's unlikely to conflict with existing OSM addresses, can be imported automatically.
2. `existingAddressesWithNewTagsOnly` - existing OSM addresses where we add new tags from Vicmap (no modifying or removing tags) and no geometry changes, can be imported automatically.
3. `addrUnitFromHousenumber` - existing OSM addresses where the existing `addr:housenumber` tag is modified to move the unit number into `addr:unit`, can be imported automatically.

## Import Process

The dedicated import account used for the import is [`vicmap_import`](https://www.openstreetmap.org/user/vicmap_import).


### Stage 0 - Find abbreviated addr:street on existing addresses
`make data/abbrStreetsMR.geojson` generates a MapRoulette challenge file with possible abbreviated street names in existing `addr:street` tags in OSM and suggests fixes. Where the suggested fix matched the unabbreviated road name then this can be safely applied.

- [x] MapRoulette challenge completed

### Stage 1 - postal_code
For background see [Inclusion of `addr:suburb`, `addr:postcode` and `addr:state`](#inclusion-of-addrsuburb-addrpostcode-and-addrstate).

Using JOSM RemoteControl commands [`postal_code`](https://wiki.openstreetmap.org/wiki/Key:postal_code) will be added to the existing Victorian `admin_level=10` boundaries using the postcode derived from Vicmap Addresses. Except for Melbourne suburb because there are two postal codes in use, and the `postal_code` boundaries are already mapped.

The tag changes are created by `bin/compareSuburb.js` which creates the JOSM RemoteControl URLs into the file at `dist/postalCodeURLs.txt`, [https://gitlab.com/alantgeo/vicmap2osm/-/snippets/2133851](https://gitlab.com/alantgeo/vicmap2osm/-/snippets/2133851).

### Stage 2 - Set unit from housenumber
During the conflation stage, Vicmap addresses which were deemed to match OSM addresses where in OSM it was represented as `addr:housenumber=X/Y` whereas in Vicmap it was represented as `addr:unit=X`, `addr:housenumber=Y`, then an automated tag change to move the unit into `addr:unit` is performed.

This will be a single Victoria wide changeset.

`bin/mr2osc.mjs` is the script which creates the OsmChange and uploads it as a changeset from the tag changes outputted from the _conflate_ stage as a MapRoulette `setTags` operation.

### Stage 3 - New addresses without conflicts

`bin/upload.sh` is the script used to perform the actual uploads into OSM. For each import candidate (by candidate category by suburb) there is one OSM Changeset created.

This makes it easier for anyone to review uploads in OSMCha and other tools.

The changeset comment used is

    Vicmap Import CANDIDATE_CATEGORY_DESCRIPTION: SUBURB_NAME. See https://wiki.openstreetmap.org/wiki/Imports/Vicmap_Address

### Changeset tags

- `source=Vicmap Address`
- `source:ref=https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap-catalogue/vicmap-address`

## Future Work

- Tracking new Vicmap addresses
- Monitoring changes over time

## Community Feedback

Consultation with the local community on talk-au at https://lists.openstreetmap.org/pipermail/talk-au/2021-May/014622.html determined:

- Existing interpolation way addresses to be replaced with individually mapped address nodes.
- Imported addresses as lone address nodes, not merged onto existing buildings or other objects.
- ~~Using `addr:suburb` as a catch-all for the placename/suburb/locality of the address, irrespective of if the value is actually referring to an OSM `place=suburb` or `place=town` or `place=hamlet` etc. (see page 25, section 15 of https://auspost.com.au/content/dam/auspost_corp/media/documents/australia-post-addressing-standards-1999.pdf).~~ _This was subsequently nullified after deciding to omit `addr:suburb`._
- ~~Further to the previous point, where an existing address uses `addr:city` but our conflation indicates that the `addr:city` value should be `addr:suburb` then this will be updated on the existing object.~~ _This was subsequently nullified after deciding to omit `addr:suburb`._
- Including full address attributes (`addr:suburb`, `addr:state`, `addr:postcode`), even when they could be derived from existing boundaries is contentious with advocates for both options. Due to this, these attributes are omitted.

This is based on discussions to date, any of these points can be further discussed if needed.
