/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const axios = require('axios');
const assign = require('object-assign');
const {isEmpty} = require('lodash');
const CoordinatesUtils = require('../qwc2/MapStore2Components/utils/CoordinatesUtils');
const ProxyUtils = require('../qwc2/MapStore2Components/utils/ProxyUtils');
const VectorLayerUtils = require('../qwc2/QWC2Components/utils/VectorLayerUtils');

const SERVICE_URL = 'http://localhost:9092/';


function somap_getFeature(layerId, mapPos, mapCrs, callback) {
    let coo = CoordinatesUtils.reproject(mapPos, mapCrs, "EPSG:2056");
    let bbox = coo.x + "," + coo.y + "," + coo.x + "," + coo.y;
    let req = SERVICE_URL + layerId + '?bbox=' + bbox;
    axios.get(ProxyUtils.addProxyIfNeeded(req)).then(response => {
        if(response.data && !isEmpty(response.data.features)) {
            let feature = response.data.features[0];
            // feature.geometry = VectorLayerUtils.reprojectGeometry(feature.geometry, srcCrs, mapCrs);

            callback(feature);
        } else {
            callback(null);
        }
    }).catch(err => callback(null));
}

function somap_addFeature(layerId, feature, mapCrs, callback) {
    let req = SERVICE_URL + layerId + '/';
    // Add CRS
    feature = assign({}, feature, {crs: {
        type: "name",
        properties: {name: "urn:ogc:def:crs:EPSG::2056"}
    }});

    axios.post(ProxyUtils.addProxyIfNeeded(req), feature).then(response => {
        callback(true);
    }).catch(err => callback(false));
}

function somap_editFeature(layerId, feature, mapCrs, callback) {
    let req = SERVICE_URL + layerId + '/' + feature.id;
    // Add CRS
    feature = assign({}, feature, {crs: {
        type: "name",
        properties: {name: "urn:ogc:def:crs:EPSG::2056"}
    }});

    axios.put(ProxyUtils.addProxyIfNeeded(req), feature).then(response => {
        callback(true);
    }).catch(err => callback(false));
}

function somap_deleteFeature(layerId, featureId, callback) {
    let req = SERVICE_URL + layerId + '/' + featureId;

    axios.delete(ProxyUtils.addProxyIfNeeded(req)).then(response => {
        callback(true);
    }).catch(err => callback(false));
}

module.exports = {
    getFeature: somap_getFeature,
    addFeature: somap_addFeature,
    editFeature: somap_editFeature,
    deleteFeature: somap_deleteFeature
}
