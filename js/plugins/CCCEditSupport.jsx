/**
 * Copyright 2017, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const assign = require('object-assign');
const uuid = require('uuid');
var ol = require('openlayers');
const {changeCCCState} = require('./actions/ccc');

class CCCEditSupport extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        ccc: PropTypes.object,
        changeCCCState: PropTypes.func
    }
    static defaultProps = {
        editing: {}
    }
    constructor(props) {
        super(props);

        this.interaction = null;
        this.layer = null;
        this.currentFeature = null;
        this.baseStyle = new ol.style.Style({
            fill: new ol.style.Fill({ color: [255, 0, 0, 0.5] }),
            stroke: new ol.style.Stroke({ color: 'red', width: 2}),
            image: new ol.style.Circle({
                radius: 8,
                fill: new ol.style.Fill({ color: [255, 0, 0, 0.5] }),
                stroke: new ol.style.Stroke({ color: 'red', width: 2})
            }),
        });
        this.interactionStyle = [
            new ol.style.Style({
                fill: new ol.style.Fill({ color: [255, 0, 0, 0.5] }),
                stroke: new ol.style.Stroke({ color: 'red', width: 2})
            }),
            new ol.style.Style({
                image: new ol.style.RegularShape({
                    fill: new ol.style.Fill({color: 'white'}),
                    stroke: new ol.style.Stroke({color: 'red', width: 2}),
                    points: 4,
                    radius: 5,
                    angle: Math.PI / 4
                }),
                geometry: (feature) => {
                    if(feature.getGeometry().getType() === "Point") {
                        return new ol.geom.MultiPoint([feature.getGeometry().getCoordinates()]);
                    } else if(feature.getGeometry().getType() === "LineString") {
                        return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates());
                    } else {
                        return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates()[0]);
                    }
                }
            })
        ];
    }
    componentWillReceiveProps(newProps) {
        if(newProps.ccc === this.props.ccc) {
            // pass
        } else if(newProps.ccc.action === 'Edit' && newProps.ccc.feature) {
            this.addEditInteraction(newProps);
        } else if(newProps.ccc.action === 'Draw' && newProps.ccc.geomType) {
            if(!newProps.ccc.feature || this.props.ccc.geomType !== newProps.ccc.geomType) {
                this.addDrawInteraction(newProps);
            }
        } else {
            this.reset();
        }
    }
    render() {
        return null;
    }
    createLayer = () => {
        let source = new ol.source.Vector();
        this.layer = new ol.layer.Vector({
            source: source,
            zIndex: 1000000,
            style: this.baseStyle
        });
        this.props.map.addLayer(this.layer);
    }
    addDrawInteraction = (newProps) => {
        this.reset();
        this.createLayer();
        let drawInteraction = new ol.interaction.Draw({
            type: newProps.ccc.geomType,
            source: this.layer.getSource(),
            condition: (event) => {  return event.pointerEvent.buttons === 1 },
            style: this.interactionStyle
        });
        drawInteraction.on('drawstart', (evt) => {
            this.currentFeature = evt.feature;
            this.currentFeature.setId(uuid.v4());
        }, this);
        drawInteraction.on('drawend', (evt) => {
            let feature = this.currentFeature;
            this.commitCurrentFeature();

            setTimeout(() => {
                this.currentFeature = feature;
                let modifyInteraction = new ol.interaction.Modify({
                    features: new ol.Collection([this.currentFeature]),
                    condition: (event) => {  return event.pointerEvent.buttons === 1 },
                    deleteCondition: (event) => {
                        // delete vertices on SHIFT + click
                        return ol.events.condition.shiftKeyOnly(event) && ol.events.condition.singleClick(event);
                    },
                    style: this.interactionStyle
                });
                this.props.map.addInteraction(modifyInteraction);
                this.interaction = modifyInteraction;
                modifyInteraction.on('modifyend', (evt) => {
                    this.commitCurrentFeature();
                }, this)

                this.props.map.removeInteraction(drawInteraction);
            }, 100);
        }, this);
        this.props.map.addInteraction(drawInteraction);
        this.interaction = drawInteraction;
    }
    addEditInteraction = (newProps) => {
        this.reset();
        this.createLayer();
        let format = new ol.format.GeoJSON();
        this.currentFeature = format.readFeature(newProps.ccc.feature);
        this.layer.getSource().addFeature(this.currentFeature);

        let modifyInteraction = new ol.interaction.Modify({
            features: new ol.Collection([this.currentFeature]),
            condition: (event) => {  return event.pointerEvent.buttons === 1 },
            deleteCondition: (event) => {
                // delete vertices on SHIFT + click
                return ol.events.condition.shiftKeyOnly(event) && ol.events.condition.singleClick(event);
            },
            style: this.interactionStyle
        });
        modifyInteraction.on('modifyend', (evt) => {
            this.commitCurrentFeature();
        }, this);
        this.props.map.addInteraction(modifyInteraction);
        this.interaction = modifyInteraction;
    }
    commitCurrentFeature = () => {
        if(!this.currentFeature) {
            return;
        }
        let format = new ol.format.GeoJSON();
        let feature = format.writeFeatureObject(this.currentFeature);
        this.props.changeCCCState({feature: feature, changed: true});
    }
    reset = () => {
        if(this.interaction) {
            this.props.map.removeInteraction(this.interaction);
        }
        this.interaction = null;
        this.currentFeature = null;
        if(this.layer) {
            this.props.map.removeLayer(this.layer);
        }
        this.layer = null;
    }
};

module.exports = connect((state) => ({
    ccc: state.ccc || {}
}), {
    changeCCCState: changeCCCState
})(CCCEditSupport);
