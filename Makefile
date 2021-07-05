# download VicMap source data
# the URL here usually gets manually updated weekly though no guarantees
# it's a mirror of the upstream VICMAP data with split shp files reduced to a single shp file
data/VICMAP_ADDRESS.zip:
	mkdir -p data
	wget --no-verbose --directory-prefix=data https://www.alantgeo.com.au/share/VICMAP_ADDRESS.zip

# cadastre used for debugging
data/VICMAP_PROPERTY.zip:
	mkdir -p data
	wget --no-verbose --directory-prefix=data https://www.alantgeo.com.au/share/VICMAP_PROPERTY.zip

data/vicmap/ll_gda94/sde_shape/whole/VIC/VMADD/layer/address.shp: data/VICMAP_ADDRESS.zip
	mkdir -p data/vicmap
	unzip -d data/vicmap -n $<
	# update mtime so that Make doesn't see it as outdated
	touch --no-create $@

data/vicmap/ll_gda94/sde_shape/whole/VIC/VMPROP/layer/property_view.shp: data/VICMAP_PROPERTY.zip
	mkdir -p data/vicmap
	unzip -d data/vicmap -n $<
	touch --no-create $@

data/vicmap-property.fgb: data/vicmap/ll_gda94/sde_shape/whole/VIC/VMPROP/layer/property_view.shp
	ogr2ogr -f FlatGeobuf -nlt PROMOTE_TO_MULTI $@ $<

data/vicmap.geojson:
	ogr2ogr -f GeoJSONSeq $@ data/vicmap/ll_gda94/sde_shape/whole/VIC/VMADD/layer/address.shp
	wc -l $@

# used for quick debugging
# ogr2ogr -f GeoJSONSeq -clipsrc 144.95392 -37.80260 144.97298 -37.79204 data/vicmap.geojson data/vicmap/ll_gda94/sde_shape/whole/VIC/VMADD/layer/address.shp
vicmapExtract:
	ogr2ogr -f GeoJSONSeq -clipsrc 144.95366 -37.80284 145.00272 -37.77482 data/vicmap.geojson data/vicmap/ll_gda94/sde_shape/whole/VIC/VMADD/layer/address.shp

cleanDist:
	rm -rf dist

dist/vicmap-osm.geojson: data/vicmap.geojson
	mkdir -p dist
	./bin/vicmap2osm.js $< $@
	wc -l $@

dist/vicmap-osm-with-suburb.geojson: data/vicmap.geojson
	mkdir -p dist
	./bin/vicmap2osm.js --preserve-derivable-properties $< $@
	wc -l $@

dist/vicmap-osm.mbtiles: dist/vicmap-osm.geojson
	tippecanoe --force -o $@ --minimum-zoom=12 --maximum-zoom=12 --no-feature-limit --no-tile-size-limit --no-tile-stats --read-parallel $<

dist/vicmap-osm-uniq.geojson: dist/vicmap-osm-with-suburb.geojson
	mkdir -p debug/reduceDuplicates
	node --max_old_space_size=4096 ./bin/reduceDuplicates.js --debug $< $@

dist/vicmap-osm-uniq-flats.geojson: dist/vicmap-osm-uniq.geojson
	mkdir -p debug/reduceOverlap
	node --max_old_space_size=4096 ./bin/reduceOverlap.js --debug $< $@

dist/vicmap-osm-uniq-flats-withinrange.geojson: dist/vicmap-osm-uniq-flats.geojson
	mkdir -p debug/reduceRangeDuplicates
	node --max_old_space_size=4096 ./bin/reduceRangeDuplicates.js --debug $< $@

dist/vicmap-osm-overlapping.geojson: dist/vicmap-osm-uniq-flats-withinrange.geojson
	node --max_old_space_size=4096 ./bin/reportOverlap.js $< $@

convertGeoJSONResultsToFGB:
	ogr2ogr -f FlatGeobuf dist/vicmap-osm.fgb dist/vicmap-osm.geojson
	ogr2ogr -f FlatGeobuf dist/vicmap-osm-with-suburb.fgb dist/vicmap-osm-with-suburb.geojson
	ogr2ogr -f FlatGeobuf dist/vicmap-osm-uniq.fgb dist/vicmap-osm-uniq.geojson
	ogr2ogr -f FlatGeobuf dist/vicmap-osm-uniq-flats.fgb dist/vicmap-osm-uniq-flats.geojson
	ogr2ogr -f FlatGeobuf dist/vicmap-osm-uniq-flats-withinrange.fgb dist/vicmap-osm-uniq-flats-withinrange.geojson

dist/canidates.geojson: dist/vicmap-osm-uniq-flats-withinrange.geojson
	cp $< $@

loadPgOSM: dist/vicmap-osm.geojson
	ogr2ogr -f PostgreSQL PG: $< -lco UNLOGGED=YES -nln vm_osm

data/vicmap.fgb: data/vicmap/ll_gda94/sde_shape/whole/VIC/VMADD/layer/address.shp
	ogr2ogr -f FlatGeobuf $@ $<

dist/vicmap-osm.fgb: dist/vicmap-osm.geojson
	ogr2ogr -f FlatGeobuf $@ $<

# useful for development to be able to query a database
loadPgAdd: data/vicmap/ll_gda94/sde_shape/whole/VIC/VMADD/layer/address.shp
	ogr2ogr -f PostgreSQL PG: $< -lco UNLOGGED=YES -nln vmadd
	# index all columns for faster queries during development
	psql -f src/createIndexQuery.sql --tuples-only | psql

loadPgProp: data/vicmap/ll_gda94/sde_shape/whole/VIC/VMPROP/layer/property_view.shp
	ogr2ogr -f PostgreSQL PG: $< -lco UNLOGGED=YES -nln vmprop -nlt MULTIPOLYGON

data/victoria.osm.pbf:
	wget --no-verbose --directory-prefix=data http://download.openstreetmap.fr/extracts/oceania/australia/victoria.osm.pbf

# addr:suburb, addr:postcode alone without a housenumber or being an interpolation way aren't of much use for comparisons
data/victoria-addr.osm.pbf: data/victoria.osm.pbf
	osmium tags-filter --output=$@ --overwrite $< addr:housenumber addr:interpolation

data/victoria-addr-extract.osm.pbf: data/victoria-addr.osm.pbf
	osmium extract --bbox 144.95366,-37.80284,145.00272,-37.77482 --output=$@ --overwrite $<

data/victoria-addr.osm.geojson: data/victoria-addr.osm.pbf
	osmium export --config=config/osmium-export-config.json --output-format=geojsonseq --format-option=print_record_separator=false --output=$@ --overwrite $<

data/victoria-addr.osm.fgb: data/victoria-addr.osm.geojson
	ogr2ogr -f FlatGeobuf -nlt PROMOTE_TO_MULTI -skipfailures -mapFieldType Integer64List=String $@ $<

data/victoria-addr.osm.centroids.fgb: data/victoria-addr.osm.fgb
	qgis_process run native:centroids -- INPUT='$<|layername=victoria-addr.osm|option:VERIFY_BUFFERS=NO' OUTPUT=$@

data/victoria-named-features.osm.pbf: data/victoria.osm.pbf
	osmium tags-filter --output=$@ --overwrite $< name

data/victoria-named-features.osm.geojson: data/victoria-named-features.osm.pbf
	osmium export --config=config/osmium-export-config-names.json --output-format=geojsonseq --format-option=print_record_separator=false --output=$@ --overwrite $<

data/abbrStreetsMR.geojson: data/victoria-addr.osm.geojson
	./bin/findAbbrStreets.js $< $@

data/asgs.zip:
	wget -O $@ 'https://www.abs.gov.au/AUSSTATS/subscriber.nsf/log?openagent&1270055001_ASGS_2016_vol_1_geopackage.zip&1270.0.55.001&Data%20Cubes&C406A18CE1A6A50ACA257FED00145B1D&0&July%202016&12.07.2016&Latest'

loadMB:
	ogr2ogr -f PostgreSQL -where 'STATE_CODE_2016 = 2' PG: /vsizip/asgs.zip/ASGS\ 2016\ Volume\ 1.gpkg -nln mb -select 'MB_CODE_2016' MB_2016_AUST

data/mb.geojson:
	ogr2ogr -f GeoJSON -where 'STATE_CODE_2016 = 2' $@ /vsizip/data/asgs.zip/ASGS\ 2016\ Volume\ 1.gpkg -lco WRITE_BBOX=YES -lco COORDINATE_PRECISION=7 -lco RFC7946=YES -lco WRITE_NAME=NO -lco ID_FIELD=MB_CODE_2016 -nln mb -select 'MB_CODE_2016' MB_2016_AUST

data/mb.fgb: data/mb.geojson
	ogr2ogr -f FlatGeobuf $@ $<

# extract roads from OSM
data/victoria-roads.osm.pbf: data/victoria.osm.pbf
	osmium tags-filter --remove-tags --output=$@ $< w/highway=motorway,trunk,primary,secondary,tertiary,unclassified,residential,living_street,road,service

# extract road lines into geojson
data/victoria-roads.geojson: data/victoria-roads.osm.pbf
	osmium export --overwrite --geometry-types=linestring --output-format=geojsonseq --format-option=print_record_separator=false --output $@ $<

data/victoria-boundary.geojson:
	./node_modules/.bin/osm-geojson 2316741 | ogr2ogr -f GeoJSONSeq -explodecollections -nlt MULTILINESTRING $@ /vsistdin/

data/victoria-roads-and-boundary.geojson: data/victoria-roads.geojson data/victoria-boundary.geojson
	cat $^ > $@

# then convert to fgb
data/victoria-roads.fgb: data/victoria-roads-and-boundary.geojson
	ogr2ogr -f FlatGeobuf -explodecollections -nlt MULTILINESTRING $@ $<

# construct block polygons based on OSM roads
data/blocks.fgb: data/victoria-roads.fgb
	qgis_process run native:polygonize -- INPUT=$< KEEP_FIELDS=FALSE OUTPUT=$@

# blocks from roads mostly works well, except for the coastal area where we end up with one large thin polygon along the coastline
# we split this one up by suburb/locality boundaries (admin_level=10) to make it smaller and more manageable
data/coastalStrip.fgb: data/blocks.fgb
	qgis_process run native:extractbylocation -- INPUT='$<|layername=blocks' INTERSECT=src/pointInPortPhillipBay.geojson OUTPUT=$@ PREDICATE=0

data/coastalStripBySuburb.fgb: data/coastalStrip.fgb data/victoria-admin-level10.osm.fgb
	qgis_process run native:intersection -- INPUT='$<|layername=coastalStrip' OVERLAY='data/victoria-admin-level10.osm.fgb|layername=victoria-admin-level10.osm' OUTPUT=$@

# replace large coastal strip in blocks with costalStripBySuburb
data/blocksExcludingCoastalStrip.fgb: data/blocks.fgb
	qgis_process run native:extractbylocation -- INPUT='$<|layername=blocks' INTERSECT=src/pointInPortPhillipBay.geojson OUTPUT=$@ PREDICATE=2

data/blocksWithCoastalStripSplit.fgb: data/blocksExcludingCoastalStrip.fgb data/coastalStripBySuburb.fgb
	qgis_process run native:mergevectorlayers -- LAYERS='data/blocksExcludingCoastalStrip.fgb|layername=blocksExcludingCoastalStrip' LAYERS='data/coastalStripBySuburb.fgb|layername=coastalStripBySuburb' OUTPUT=$@

data/osmSuburbLines.fgb:
	qgis_process run native:polygonstolines -- INPUT=data/victoria-admin-level10.osm.geojson OUTPUT=$@

data/suburbLinesInCoastalStrip.fgb: data/osmSuburbLines.fgb
	qgis_process run native:extractbylocation -- INPUT='$<|layername=osmSuburbLines' INTERSECT='data/coastalStrip.fgb|layername=coastalStrip' OUTPUT=$@ PREDICATE=0

data/suburbLinesInCoastalStripDissolved.fgb: data/suburbLinesInCoastalStrip.fgb
	qgis_process run native:dissolve -- INPUT='$<|layername=suburbLinesInCoastalStrip' OUTPUT=$@

data/coastStripSplitBySuburb.fgb: data/coastalStrip.fgb data/suburbLinesInCoastalStripDissolved.fgb
	qgis_process run native:splitwithlines -- INPUT='$<|layername=coastalStrip' LINES='data/suburbLinesInCoastalStripDissolved.fgb|layername=suburbLinesInCoastalStripDissolved' OUTPUT=$@

# count OSM addresses by block, those with no OSM addresses we can import all the candidate addresses without conflation issues
dist/blocksByOSMAddr.fgb: data/victoria-addr.osm.centroids.fgb data/blocksWithCoastalStripSplit.fgb
	qgis_process run native:countpointsinpolygon -- POINTS=$< POLYGONS='data/blocksWithCoastalStripSplit.fgb' FIELD=NUMPOINTS OUTPUT=$@

dist/blocksByOSMAddr.geojson: dist/blocksByOSMAddr.fgb
	ogr2ogr -f GeoJSONSeq -select 'NUMPOINTS' $@ $<

summariseBlocksByOSMAddr: dist/blocksByOSMAddr.geojson
	ogrinfo -dialect sqlite -sql 'select count(*), NUMPOINTS = 0 from blocksByOSMAddr group by (NUMPOINTS = 0)' $<

# conflate processed vicmap data with osm data
dist/conflate:
	mkdir -p $@
	./bin/conflate.js dist/vicmap-osm-uniq-flats-withinrange.geojson data/victoria-addr.osm.geojson dist/blocksByOSMAddr.geojson $@
	./bin/mrCoopDiff.js $@/mr_exactMatchSetFlats.geojson $@/mr_exactMatch.changes.json

dist/unitFromNumber.osc: dist/conflate/mr_explodeUnitFromNumber.geojson
	./bin/mr2osc.mjs --dry-run --changeset-comment "Vicmap Import separate addr:unit and addr:housenumber where matched with Vicmap and previously were combined as unit/number" $< $@

convertConflationResultsToFGB:
	ogr2ogr -f FlatGeobuf dist/conflate/withinExistingOSMAddressPoly.fgb dist/conflate/withinExistingOSMAddressPoly.geojson
	ogr2ogr -f FlatGeobuf dist/conflate/notFoundInBlocks.fgb dist/conflate/notFoundInBlocks.geojson
	ogr2ogr -f FlatGeobuf dist/conflate/exactMatch.fgb dist/conflate/exactMatch.geojson
	ogr2ogr -f FlatGeobuf dist/conflate/exactMatchLines.fgb dist/conflate/exactMatchLines.geojson
	ogr2ogr -f FlatGeobuf dist/conflate/noExactMatch.fgb dist/conflate/noExactMatch.geojson
	ogr2ogr -f FlatGeobuf dist/conflate/noOSMAddressWithinBlock.fgb dist/conflate/noOSMAddressWithinBlock.geojson
	ogr2ogr -f FlatGeobuf dist/conflate/fuzzyStreetMatchesSingle.fgb dist/conflate/fuzzyStreetMatchesSingle.geojson
	ogr2ogr -f FlatGeobuf dist/conflate/fuzzyStreetMatchesMultiple.fgb dist/conflate/fuzzyStreetMatchesMultiple.geojson

dist/vicmap-complex-conflation: dist/vicmap-complex.geojson
	mkdirp -p $@
	./bin/complex.js $< data/victoria-named-features.osm.geojson $@

dist/vicmap-building-conflation: dist/vicmap-building.geojson
	mkdirp -p $@
	./bin/building.js $< data/victoria-named-features.osm.geojson $@

# extract admin_level=10 from OSM
data/victoria-admin.osm.pbf: data/victoria.osm.pbf
	osmium tags-filter --remove-tags --output=$@ $< r/boundary=administrative

data/victoria-admin-level10.osm.pbf: data/victoria-admin.osm.pbf
	osmium tags-filter --remove-tags --output=$@ $< r/admin_level=10

data/victoria-admin-level10.osm.geojson: data/victoria-admin-level10.osm.pbf
	osmium export --overwrite --config=config/osmium-export-config-adminlevel10.json --geometry-types=polygon --add-unique-id=type_id --output-format=geojsonseq --format-option=print_record_separator=false --output $@ $<

data/victoria-admin-level10.osm.fgb: data/victoria-admin-level10.osm.geojson
	ogr2ogr -f FlatGeobuf $@ $<

dist/vicmapSuburbDiffersWithOSM.geojson: dist/vicmap-osm-with-suburb.geojson data/victoria-admin-level10.osm.geojson
	rm -f dist/postalCodeURLs.txt
	./bin/compareSuburb.js $^ $@ dist/suburbsWithPostcodeCounts.geojson dist/postalCodeInstructions.json dist/postalCodeURLs.txt
	wc -l $@

printDifferentSuburbs: dist/vicmapSuburbDiffersWithOSM.geojson
	echo "OSM Suburb,Vicmap Suburb"
	ogr2ogr -f CSV -select '_osmSuburb,addr:suburb' /vsistdout/ $< | tail -n+2 | sort | uniq

dist/candidates: data/victoria-admin-level10.osm.geojson dist/conflate
	mkdir -p $@
	./bin/candidates.js $^ $@

testUploadCandidates:
	./upload/osm2change.py dist/candidates/newAddressesInBlocksWithoutAnyExisting/a4755005_Wodonga.osm
	./upload/upload.py -u 'vicmap_import' -p "${OSM_DEV_PASSWORD}" -c yes -m 'Vicmap Import Test Changeset' -y 'Vicmap Address' dist/candidates/newAddressesInBlocksWithoutAnyExisting/a4755005_Wodonga.osm
