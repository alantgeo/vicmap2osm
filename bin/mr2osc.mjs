#!/usr/bin/env node

/**
 * Given a MapRoulette Cooperative Challenge, upload all the changes directly without review
 */

import fs from 'fs'
import { pipeline } from 'stream/promises'
import { Transform } from 'stream'
import ndjson from 'ndjson'
import _ from 'lodash'
import fetch from 'node-fetch'
import xml from 'xml-js'
import yargs from 'yargs'

const argv = yargs(process.argv.slice(2))
  .option('dry-run', {
    type: 'boolean',
    description: 'Skip uploading to OSM, instead log what we would do'
  })
  .option('changeset-comment', {
    type: 'string',
    description: 'OSM Changeset comment',
    demandOption: true
  })
  .argv

if (argv._.length < 2) {
  console.error("Usage: ./mr2osc.js mr.json change.osc")
  process.exit(1)
}

const mrFile = argv._[0]
const changeFile = argv._[1]

if (!fs.existsSync(mrFile)) {
  console.error(`${mrFile} not found`)
  process.exit(1)
}

if (argv.dryRun) {
  console.log('Dry run enabled')
}

// https://wiki.openstreetmap.org/wiki/API_v0.6#Multi_fetch:_GET_.2Fapi.2F0.6.2F.5Bnodes.7Cways.7Crelations.5D.3F.23parameters
const MAXIMUM_ELEMENTS_PER_GET_REQUEST = 725

const OSM_API_READ = 'https://api.openstreetmap.org'
const OSM_API_WRITE = (process.env.ENVIRONMENT === 'prod') ? 'https://api.openstreetmap.org' : 'https://master.apis.dev.openstreetmap.org'
const USER_AGENT = 'vicmap2osm/1.0 (+https://gitlab.com/alantgeo/vicmap2osm)'
const CREATED_BY = 'https://gitlab.com/alantgeo/vicmap2osm'
const AUTHORIZATION = `Basic ${Buffer.from(process.env.OSM_USERNAME + ':' + process.env.OSM_PASSWORD).toString('base64')}`
let MAXIMUM_ELEMENTS_PER_UPLOAD_REQUEST = 10000

const changesetTags = {
  created_by: CREATED_BY,
  comment: argv.changesetComment,
  source: 'Vicmap Address',
  'source:ref': 'https://www.land.vic.gov.au/maps-and-spatial/spatial-data/vicmap-catalogue/vicmap-address'
}

console.log(`Retrieving capabilities from ${OSM_API_WRITE}`)
await fetch(`${OSM_API_WRITE}/api/capabilities`, {
  headers: {
    'User-Agent': USER_AGENT
  }
})
  .then(res => res.text())
  .then(text => {
    const capabilities = JSON.parse(xml.xml2json(text, {
      compact: true
    }))
    const apiMaximumElements = capabilities.osm.api.changesets._attributes.maximum_elements
    MAXIMUM_ELEMENTS_PER_UPLOAD_REQUEST = Math.min(MAXIMUM_ELEMENTS_PER_UPLOAD_REQUEST, apiMaximumElements)
  })

const operations = {
  node: {},
  way: {},
  relation: {}
}

// full OSM Elements live from OSM API
const elements = {}

const changes = {
  node: [],
  way: [],
  relation: []
}

let taskCount = 0
/**
 * Transform which receives MapRoulette tasks and
 * stores operations by Element type by id in `operations`.
 */
const listElements = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  transform(task, encoding, callback) {
    taskCount++

    if (process.stdout.isTTY && taskCount % 1000 === 0) {
      process.stdout.write(` ${taskCount.toLocaleString()}\r`)
    }

    if (task && task.features && task.features.length && task.cooperativeWork && task.cooperativeWork.operations && task.cooperativeWork.operations.length) {
      const operation = task.cooperativeWork.operations[0]

      if (operation.operationType === 'modifyElement') {
        const type = operation.data.id.split('/')[0]
        const id = operation.data.id.split('/')[1]
        operations[type][id] = operation.data.operations
      }
    }

    callback()
  }
})

/**
 * Fetch all Elements with operations from `operations`
 * so we have the full Element to generate the OsmChange.
 * Results stored in `elements`.
 */
async function fetchElements() {
  /*
  const nodeChunks = _.chunk(Object.keys(operations.nodes), MAXIMUM_ELEMENTS_PER_GET_REQUEST)
  const wayChunks = _.chunk(Object.keys(operations.ways), MAXIMUM_ELEMENTS_PER_GET_REQUEST)
  const relationChunks = _.chunk(Object.keys(operations.relations), MAXIMUM_ELEMENTS_PER_GET_REQUEST)
  */

  for (const type in operations) {
    let index = 0
    const chunks = _.chunk(Object.keys(operations[type]), MAXIMUM_ELEMENTS_PER_GET_REQUEST)
    for (const chunk of chunks) {
      index++

      process.stdout.write(`   Fetch ${type}s (${index}/${chunks.length})\r`)
      await fetch(`${OSM_API_READ}/api/0.6/${type}s?${type}s=${chunk.join(',')}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': USER_AGENT
        }
      })
        .then(res => res.json())
        .then(json => {
          json.elements.forEach(element => {
            elements[`${element.type}/${element.id}`] = element
          })
        })
        .catch(err => {
          console.error(err)
          process.exit(1)
        })
    }
    process.stdout.write(`\r`)
    process.stdout.write(`   Fetched ${chunks.length} ${type}s\n`)
  }
  return Promise.resolve()

  /*
  return [
    ...nodeChunks.map(nodeChunk => {
      return fetch(`${OSM_API_READ}/api/0.6/nodes?nodes=${nodeChunk.join(',')}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': USER_AGENT
        }
      })
        .then(res => res.json())
        .then(json => {
          json.elements.forEach(element => {
            elements[`${element.type}/${element.id}`] = element
          })
        })
    }),
    ...wayChunks.map(wayChunk => {
      return fetch(`${OSM_API_READ}/api/0.6/ways?ways=${wayChunk.join(',')}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': USER_AGENT
        }
      })
        .then(res => res.json())
        .then(json => {
          json.elements.forEach(element => {
            elements[`${element.type}/${element.id}`] = element
          })
        })
    }),
    ...relationChunks.map(relationChunk => {
      return fetch(`${OSM_API_READ}/api/0.6/relations?relations=${relationChunk.join(',')}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': USER_AGENT
        }
      })
        .then(res => res.json())
        .then(json => {
          json.elements.forEach(element => {
            elements[`${element.type}/${element.id}`] = element
          })
        })
    })
  ])
  */
}

function createChanges() {
  for (const type in operations) {
    for (const [id, ops] of Object.entries(operations[type])) {
      const element = elements[`${type}/${id}`]
      const tags = []

      if (ops && ops.length) {
        ops.forEach(operation => {
          if (operation.operation === 'setTags') {
            // first ensure that our assumptions about the current values of these tags hasn't changed
            // TODO

            // tags to set
            for (const [key, value] of Object.entries(operation.data)) {
              // replace with new tag
              element.tags[key] = value
            }
          }
        })
      }

      // set nodeChanges for this node
      for (const [key, value] of Object.entries(element.tags)) {
        const tag = {
          _attributes: {
            k: key,
            v: value
          }
        }
        tags.push(tag)
      }
      switch (type) {
        case 'node':
          changes[type].push({
            _attributes: {
              id: id,
              version: element.version + 1,
              lat: element.lat,
              lon: element.lon
            },
            tag: tags
          })
          break
        case 'way':
          changes[type].push({
            _attributes: {
              id: id,
              version: element.version + 1,
            },
            tag: tags,
            nodes: element.nodes
          })
          break
        case 'relation':
          changes[type].push({
            _attributes: {
              id: id,
              version: element.version + 1,
            },
            tag: tags,
            members: element.members
          })
          break
      }
    }
  }
}

async function uploadChanges() {
  // now we have the latest full elements, apply our changes as an OsmChange
  // https://wiki.openstreetmap.org/wiki/API_v0.6#Diff_upload:_POST_.2Fapi.2F0.6.2Fchangeset.2F.23id.2Fupload

  const totalElements = Object.values(changes).flat().length
  const totalChangesets = Math.ceil(totalElements / MAXIMUM_ELEMENTS_PER_UPLOAD_REQUEST)
  if (totalChangesets > 1) {
    console.log(`${totalElements} exceeds API maximum elements of ${MAXIMUM_ELEMENTS_PER_UPLOAD_REQUEST} splitting into ${totalChangesets} changesets`)
    process.exit(1)
  }

  for (let changesetIndex = 0; changesetIndex < totalChangesets; changesetIndex++) {
    // create a changeset
    let changesetId
    const createBody = xml.json2xml({
      _declaration: {
        _attributes: {
          version: "1.0",
          encoding: "UTF-8"
        }
      },
      osm: {
        changeset: {
          tag: Object.keys(changesetTags).map(key => {
            return {
              _attributes: {
                k: key,
                v: changesetTags[key]
              }
            }
          })
        }
      }
    }, Object.assign({compact: true}, argv.dryRun ? { spaces: 2 } : {}))
    if (argv.dryRun) {
      console.log(`${OSM_API_WRITE}/api/0.6/changeset/create`)
      console.log(createBody)
    } else {
      changesetId = await fetch(`${OSM_API_WRITE}/api/0.6/changeset/create`, {
        method: 'PUT',
        headers: {
          'Authorization': AUTHORIZATION,
          'User-Agent': USER_AGENT
        },
        body: createBody
      })
        .then(res => res.text())
      console.log(`Opened changeset ${changesetId}`)
    }

    /*
    const nodeChangesCount = changes.node.length
    const wayChangesCount = changes.node.length
    const relationChangesCount = changes.node.length

    const startIndex = changeIndex * MAXIMUM_ELEMENTS_PER_UPLOAD_REQUEST
    const endIndex = ((changeIndex + 1) * MAXIMUM_ELEMENTS_PER_UPLOAD_REQUEST) - 1

    if (startIndex < nodeChangesCount) {
      changes.node.slice(startIndex, )
    }
    */

    // upload to the changeset
    const uploadBody = xml.json2xml({
      _declaration: {
        _attributes: {
          version: "1.0",
          encoding: "UTF-8"
        }
      },
      osmChange: {
        _attributes: {
          version: '0.6',
          generator: CREATED_BY
        },
        modify: {
          node: changes.node.map(change => insertChangesetId(change, changesetId)),
          way: changes.way.map(change => insertChangesetId(change, changesetId)),
          relation: changes.relation.map(change => insertChangesetId(change, changesetId))
        }
      }
    }, Object.assign({
      compact: true,
      attributeValueFn: value => {
        // these values were tested with test/xmlEntities.js
        return value.replace(/&quot;/g, '"')  // convert quote back before converting amp
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
      }
    }, argv.dryRun ? { spaces: 2 } : {}))

    const filePath = totalChangesets > 1 ? path.join(path.dirname(changeFile), path.basename(changeFile, '.osc') + '-' + (changesetIndex + 1) + '.osc') : changeFile
    fs.writeFileSync(filePath, uploadBody)
    console.log(`Saved ${filePath}`)

    if (argv.dryRun) {
      console.log(`${OSM_API_WRITE}/api/0.6/changeset/${changesetId}/upload`)
    } else {
      await fetch(`${OSM_API_WRITE}/api/0.6/changeset/${changesetId}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': AUTHORIZATION,
          'User-Agent': USER_AGENT
        },
        body: uploadBody
      })
      console.log(`Uploaded contents to ${changesetId}`)
    }

    // close the changeset
    if (argv.dryRun) {
      console.log(`${OSM_API_WRITE}/api/0.6/changeset/${changesetId}/close`)
    } else {
      await fetch(`${OSM_API_WRITE}/api/0.6/changeset/${changesetId}/close`, {
        method: 'PUT',
        headers: {
          'Authorization': AUTHORIZATION,
          'User-Agent': USER_AGENT
        }
      })
      console.log(`Closed changeset ${changesetId}`)
    }
  }

  return
}

function insertChangesetId(change, changesetId) {
  change._attributes.changeset = changesetId
  return change
}

console.log('Step 1/4: Find Elements to modify')
async function run() {
  await pipeline(
    fs.createReadStream(mrFile),
    ndjson.parse(),
    listElements,
  )

  for (const [type, value] of Object.entries(operations)) {
    console.log(`   ${type}s ${Object.keys(value).length}`)
  }

  console.log('Step 2/4: Fetch latest Elements to modify from OSM API')
  await fetchElements()

  console.log('Step 3/4: Create changes')
  createChanges()

  console.log('Step 4/4: Upload changes')
  await uploadChanges()

  console.log('Success')
}

run().catch(console.error)
