#!/usr/bin/env node

const fetch = require('node-fetch')
const xml = require('xml-js')

// RAW value is `"Testing & complex < characters > '.`
// JSON value is "name": "\"Testing & complex < characters > '."
fetch(`https://master.apis.dev.openstreetmap.org/api/0.6/node/4327735719`, {
  headers: {
      'Accept': 'application/json'
  }
})
  .then(res => res.json())
  .then(json => {
    const element = json.elements[0]
    const body = xml.json2xml({
      _declaration: {
        _attributes: {
          version: "1.0",
          encoding: "UTF-8"
        }
      },
      osmChange: {
        _attributes: {
          version: '0.6'
        },
        modify: {
          node: [
            {
              _attributes: {
                id: element.id,
                version: element.version + 1,
                lat: element.lat,
                lon: element.lon
              },
              tag: [
                {
                  _attributes: {
                    k: 'name',
                    v: element.tags.name
                  }
                }
              ]
            }
          ]
        }
      }
    }, Object.assign({
      compact: true,
      attributeValueFn: value => {
        return value.replace(/&quot;/g, '"')  // convert quote back before converting amp
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
      }
    }, { spaces: 2 }))
    console.log(body)
    // result should match view-source:https://master.apis.dev.openstreetmap.org/api/0.6/node/4327735719
    // <tag k="name" v="&quot;Testing &amp; complex &lt; characters &gt; '."/>
  })
