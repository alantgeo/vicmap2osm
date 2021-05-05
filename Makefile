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

vicmapExtract:
	ogr2ogr -f GeoJSONSeq -clipsrc 144.95392 -37.80260 144.97298 -37.79204 data/vicmap.geojson data/vicmap/ll_gda94/sde_shape/whole/VIC/VMADD/layer/address.shp

dist/vicmap-osm.geojson: data/vicmap.geojson
	./bin/vicmap2osm.js $< $@

dist/vicmap-osm-uniq.geojson: dist/vicmap-osm.geojson
	node --max-old-space-size=4096 bin/reduceDuplicates.js $< $@

dist/vicmap-osm-uniq-flats.geojson: dist/vicmap-osm-uniq.geojson
	./bin/reduceOverlap.js $< $@

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
	ogr2ogr -f PostgreSQL PG: $< -lco UNLOGGED=YES -nln vmprop
