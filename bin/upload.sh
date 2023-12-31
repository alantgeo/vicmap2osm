#!/bin/bash

set -e

mkdir -p uploadLog

IMPORT_DOC="https://wiki.openstreetmap.org/wiki/Imports/Vicmap_Address"

i=0
totalFiles=`ls -1 dist/candidates/newAddressesInBlocksWithoutAnyExisting/*.osm | wc -l`
categoryMessage="New addresses in blocks without any existing addresses"
stage="Stage 3"
for f in dist/candidates/newAddressesInBlocksWithoutAnyExisting/*.osm; do
    i=$(($i + 1))
    d=`dirname "$f"`
    b=`basename "$f" .osm`
    id=`echo "$b" | cut -d'_' -f1`
    name=`echo "$b" | cut -d'_' -f2`

    echo "$i/$totalFiles $id: $name"

    echo "   to osc"
	./upload/osm2change.py "$f"

    if [ ! -e "$d/$b.osc" ] ; then
        echo "$d/$b.osc not found"
        echo '$f' >> uploadLog/oscNotFound.txt
    else
        echo "   upload"
        ./upload/upload.py \
            -u 'vicmap_import' \
            -p "${OSM_DEV_PASSWORD}" \
            -c yes \
            -m "Vicmap Address Import - $stage - $categoryMessage: $name. See $IMPORT_DOC" \
            -y 'Vicmap Address' \
            "$d/$b.osc"
        echo "$f" >> uploadLog/uploaded.txt
    fi

    # give the api a rest
    sleep 1s

    # stop after first, used during testing
    exit
done
