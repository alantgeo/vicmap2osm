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

data/vicmap.geojson: data/vicmap/ll_gda94/sde_shape/whole/VIC/VMADD/layer/address.shp
	ogr2ogr -f GeoJSONSeq $@ $<

dist/vicmap-osm.geojson: data/vicmap.geojson
	./vicmap2osm.js $< $@

dist/vicmap-osm-flats.geojson: dist/vicmap-osm.geojson
	./reduceOverlap.js $< $@

data/vicmap.fgb: data/vicmap/ll_gda94/sde_shape/whole/VIC/VMADD/layer/address.shp
	ogr2ogr -f FlatGeobuf $@ $<

dist/vicmap-osm.fgb: dist/vicmap-osm.geojson
	ogr2ogr -f FlatGeobuf $@ $<
