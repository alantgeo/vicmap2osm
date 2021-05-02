# download VicMap source data
# the URL here usually gets manually updated weekly though no guarantees
# it's a mirror of the upstream VICMAP data with split shp files reduced to a single shp file
downloadVicmap:
	mkdir -p data
	wget --directory-prefix=data https://www.alantgeo.com.au/share/VICMAP_ADDRESS.zip

unzip: data/VICMAP_ADDRESS.zip
	mkdir -p data/vicmap
	unzip -d data/vicmap $<

data/vicmap.geojson: data/vicmap/ll_gda94/sde_shape/whole/VIC/VMADD/layer/address.shp
	ogr2ogr -f GeoJSONSeq $@ $<

dist/vicmap-osm.geojson: data/vicmap.geojson
	./vicmap2osm.js $< $@

data/vicmap.fgb: data/vicmap/ll_gda94/sde_shape/whole/VIC/VMADD/layer/address.shp
	ogr2ogr -f FlatGeobuf $@ $<

dist/vicmap-osm.fgb: dist/vicmap-osm.geojson
	ogr2ogr -f FlatGeobuf $@ $<
