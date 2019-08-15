/**
 * Copyright 2019, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');
const PropTypes = require('prop-types');
const {connect} = require('react-redux');
const {createSelector} = require('reselect');
const isEmpty = require('lodash.isempty');
const axios = require('axios');
const {zoomToPoint,panTo} = require('qwc2/actions/map');
const {LayerRole, addLayerFeatures, addThemeSublayer, removeLayer} = require('qwc2/actions/layers');
const {setCurrentTask} = require('qwc2/actions/task');
const Icon = require('qwc2/components/Icon');
const Message = require("qwc2/components/I18N/Message");
const displayCrsSelector = require('qwc2/selectors/displaycrs');
const ConfigUtils = require("qwc2/utils/ConfigUtils");
const LayerUtils = require('qwc2/utils/LayerUtils');
const LocaleUtils = require('qwc2/utils/LocaleUtils');
const CoordinatesUtils = require('qwc2/utils/CoordinatesUtils');
const MapUtils = require('qwc2/utils/MapUtils');
const MiscUtils = require('qwc2/utils/MiscUtils');
const {UrlParams} = require("qwc2/utils/PermaLinkUtils");
require('./style/SearchBox.css');

class SearchBox extends React.Component {
    static propTypes = {
        map: PropTypes.object,
        theme: PropTypes.object,
        layers: PropTypes.array,
        localConfig: PropTypes.object,
        searchFilter: PropTypes.string,
        displaycrs: PropTypes.string,
        resultLimit: PropTypes.number,
        addThemeSublayer: PropTypes.func,
        addLayerFeatures: PropTypes.func,
        removeLayer: PropTypes.func,
        setCurrentTask: PropTypes.func,
        zoomToPoint: PropTypes.func,
        panTo: PropTypes.func,
        searchOptions: PropTypes.object
    }
    static defaultProps = {
        resultLimit: 20
    }
    state = {
        searchText: "",
        recentSearches: [],
        searchResults: {},
        resultsVisible: false,
        collapsedSections: {},
        expandedLayerGroup: null,
        activeLayerInfo: null
    }
    static contextTypes = {
        messages: PropTypes.object
    }
    constructor(props) {
        super(props);
        this.searchBox = null;
        this.searchTimeout = null;
        this.preventBlur = false;
    }
    componentDidMount() {
        this.setState({searchText: UrlParams.getParam('st') || ""});
    }
    componentWillReceiveProps = (newProps) => {
        // Restore highlight from URL as soon as theme is loaded
        if(newProps.theme && !this.props.theme) {
            let hc = UrlParams.getParam('hc');
            let hp = UrlParams.getParam('hp');
            let hf = UrlParams.getParam('hf');
            if(hp && hf) {
                const DATA_URL = ConfigUtils.getConfigProp("editServiceUrl").replace(/\/$/g, "");
                axios.get(DATA_URL + "/" + hp + "/?filter=" + hf)
                .then(response => this.showFeatureGeometry(response.data, this.props.localConfig.startupParams.s));
            } else if(typeof(hc) === "string" && (hc.toLowerCase() === "true" || hc === "1")) {
                this.selectCoordinateResult({
                    display: newProps.map.center[0] + ", " + newProps.map.center[1] + " (EPSG:2056)",
                    x: newProps.map.center[0],
                    y: newProps.map.center[1],
                    crs: "EPSG:2056"
                }, false);
            }
            UrlParams.updateParams({hp: undefined, hf: undefined, hc: undefined});
        }
    }
    renderRecentResults = () => {
        let recentSearches = this.state.recentSearches.filter(entry => entry.toLowerCase().includes(this.state.searchText.toLowerCase()));
        if(isEmpty(recentSearches) || (recentSearches.length === 1 && recentSearches[0].toLowerCase() === this.state.searchText.toLowerCase())) {
            return null;
        }
        return (
            <div key="recent">
                <div className="searchbox-results-section-title" onMouseDown={this.killEvent} onClick={ev => this.toggleSection("recent")}>
                    <Icon icon={!!this.state.collapsedSections["recent"] ? "expand" : "collapse"} /><Message msgId="searchbox.recent" />
                </div>
                {!this.state.collapsedSections["recent"] ? (
                    <div className="searchbox-results-section-body">
                        {recentSearches.map((entry ,idx) => (
                            <div key={"r" + idx} className="searchbox-result" onMouseDown={this.killEvent} onClick={ev => this.searchTextChanged(entry)}>
                                {entry}
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        );
    }
    renderFilters = () => {
        if(isEmpty(this.state.searchResults.result_counts) || this.state.searchResults.result_counts.length < 2) {
            return null;
        }
        const minResultsExanded = ConfigUtils.getConfigProp("minResultsExanded");
        let initialCollapsed = this.state.searchResults.tot_result_count < minResultsExanded;
        let collapsed = (this.state.collapsedSections["filter"] === undefined) ? initialCollapsed : this.state.collapsedSections["filter"];
        let values = this.state.searchResults.result_counts.map(entry => entry.filterword + ": " + this.state.searchResults.query_text);
        values.sort((a, b) => a.localeCompare(b));
        return (
            <div key="filter">
                <div className="searchbox-results-section-title" onMouseDown={this.killEvent} onClick={ev => this.toggleSection("filter")}>
                    <Icon icon={collapsed ? "expand" : "collapse"} /><Message msgId="searchbox.filter" />
                </div>
                {!collapsed ? (
                    <div className="searchbox-results-section-body">
                        {values.map((value, idx) => {
                            return (
                                <div key={"f" + idx} className="searchbox-result" onMouseDown={this.killEvent} onClick={ev => this.searchTextChanged(value)}>
                                    <span className="searchbox-result-label">{value}</span>
                                </div>
                            );
                        })}
                    </div>
                ) : null}
            </div>
        );
    }
    renderCoordinates = () => {
        let coordinates = (this.state.searchResults.results || []).filter(result => result.coordinate);
        if(isEmpty(coordinates)) {
            return null;
        }
        return (
            <div key="coordinates">
                <div className="searchbox-results-section-title" onMouseDown={this.killEvent} onClick={ev => this.toggleSection("coordinates")}>
                    <Icon icon={!!this.state.collapsedSections["coordinates"] ? "expand" : "collapse"} /><Message msgId="searchbox.coordinates" />
                </div>
                {!this.state.collapsedSections["coordinates"] ? (
                    <div className="searchbox-results-section-body">
                        {coordinates.map((entry ,idx) => (
                            <div key={"c" + idx} className="searchbox-result" onMouseDown={this.killEvent} onClick={ev => {this.selectCoordinateResult(entry.coordinate); this.blur(); }}>
                                <span className="searchbox-result-label">{entry.coordinate.display}</span>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        );
    }
    renderPlaces = () => {
        let features = (this.state.searchResults.results || []).filter(result => result.feature);
        if(isEmpty(features)) {
            return null;
        }
        let featureResultCount = (this.state.searchResults.result_counts || []).reduce((res, entry) => res + (entry.dataproduct_id !== 'dataproduct' ? (entry.count || 0) : 0), 0);
        let additionalResults = featureResultCount - features.length;
        let iconPath = ConfigUtils.getConfigProp("assetsPath").replace(/\/$/g, "") + '/img/search/';
        return (
            <div key="places">
                <div className="searchbox-results-section-title" onMouseDown={this.killEvent} onClick={ev => this.toggleSection("places")}>
                    <Icon icon={!!this.state.collapsedSections["places"] ? "expand" : "collapse"} /><Message msgId="searchbox.places" />
                </div>
                {!this.state.collapsedSections["places"] ? (
                    <div className="searchbox-results-section-body">
                        {features.map((entry ,idx) => (
                            <div key={"p" + idx} className="searchbox-result" onMouseDown={this.killEvent} onClick={ev => { this.selectFeatureResult(entry.feature); this.blur(); }}>
                                <img src={iconPath + entry.feature.dataproduct_id + ".svg"} onError={ev => { ev.target.src = iconPath + "feature.svg";}} />
                                <span className="searchbox-result-label">{entry.feature.display}</span>
                            </div>
                        ))}
                        {additionalResults > 0 && (
                            <div className="searchbox-more-results">
                                {additionalResults}&nbsp;<Message msgId="searchbox.more" />
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        );
    }
    renderLayers = () => {
        let layers = (this.state.searchResults.results || []).filter(result => result.dataproduct);
        if(isEmpty(layers)) {
            return null;
        }
        let additionalLayerResults = !isEmpty((this.state.searchResults.result_counts || []).filter(entry => entry.dataproduct_id == 'dataproduct'));
        return (
            <div key="layers">
                <div className="searchbox-results-section-title" onMouseDown={this.killEvent} onClick={ev => this.toggleSection("layers")}>
                    <Icon icon={!!this.state.collapsedSections["layers"] ? "expand" : "collapse"} /><Message msgId="searchbox.layers" />
                </div>
                {!this.state.collapsedSections["layers"] ? (
                    <div className="searchbox-results-section-body">
                        {layers.map((entry ,idx) => !isEmpty(entry.dataproduct.sublayers) ? this.renderLayerGroup(entry.dataproduct, idx) : this.renderLayer(entry.dataproduct, idx))}
                        {additionalLayerResults ? (
                            <div className="searchbox-more-results">
                                <Message msgId="searchbox.morelayers" />
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        );
    }
    renderLayer = (dataproduct, idx) => {
        let iconPath = ConfigUtils.getConfigProp("assetsPath").replace(/\/$/g, "") + '/img/search/';
        let showAbstract = dataproduct.dataproduct_id in (this.state.activeLayerInfo || {});
        return (
            <div key={"p" + idx}>
                <div className={"searchbox-result " + (showAbstract ? "searchbox-result-expandedinfo" : "")} onMouseDown={this.killEvent} onClick={ev => { this.selectLayerResult(dataproduct); this.blur(); }}>
                    <img src={iconPath + dataproduct.dataproduct_id + ".svg"} onError={ev => { ev.target.src = iconPath + "dataproduct.svg";}} />
                    <span className="searchbox-result-label">{dataproduct.display}</span>
                    {dataproduct.dset_info ? (<Icon icon="info-sign" onClick={ev => {this.killEvent(ev); this.selectLayerResult(dataproduct, true); }} />) : null}
                </div>
                {showAbstract ? (
                    <div className="searchbox-result-abstract"
                        dangerouslySetInnerHTML={{__html: this.getLayerDescription(this.state.activeLayerInfo[dataproduct.dataproduct_id][0])}}
                    />
                ) : null}
            </div>
        );
    }
    renderLayerGroup = (dataproduct, idx) => {
        let iconPath = ConfigUtils.getConfigProp("assetsPath").replace(/\/$/g, "") + '/img/search/';
        let showAbstract = dataproduct.dataproduct_id in (this.state.activeLayerInfo || {});
        return [(
            <div key={"g" + idx}>
                <div className={"searchbox-result " + (showAbstract ? "searchbox-result-expandedinfo" : "")} onMouseDown={this.killEvent} onClick={ev => { this.selectLayerResult(dataproduct); this.blur(); }}>
                    <img src={iconPath + (this.state.expandedLayerGroup === dataproduct.dataproduct_id ? "layergroup_close" : "layergroup_open") + ".svg"} onClick={ev => this.toggleLayerGroup(ev, dataproduct.dataproduct_id)} />
                    <span className="searchbox-result-label">{dataproduct.display}</span>
                    {dataproduct.dset_info ? (<Icon icon="info-sign" onClick={ev => {this.killEvent(ev); this.selectLayerResult(dataproduct, true); }} />) : null}
                </div>
                {showAbstract ? (
                    <div className="searchbox-result-abstract"
                        dangerouslySetInnerHTML={{__html: this.getLayerDescription(this.state.activeLayerInfo[dataproduct.dataproduct_id][0])}}
                    />
                ) : null}
            </div>
        ),
        this.state.expandedLayerGroup === dataproduct.dataproduct_id ? (
            <div key={"eg" + idx} className="searchbox-result-group">{dataproduct.sublayers.map(this.renderLayer)}</div>
        ) : null
    ];
    }
    getLayerDescription = (layer) => {
        if(isEmpty(layer.abstract)) {
            return LocaleUtils.getMessageById(this.context.messages, "searchbox.nodescription");
        } else {
            return MiscUtils.addLinkAnchors(layer.abstract);
        }
    }
    toggleLayerGroup = (ev, dataproduct_id) => {
        this.killEvent(ev);
        this.setState({expandedLayerGroup: this.state.expandedLayerGroup === dataproduct_id ? null : dataproduct_id});
    }
    renderSearchResults = () => {
        if(!this.state.resultsVisible) {
            return false;
        }
        let children = [
            this.renderRecentResults(),
            this.renderFilters(),
            this.renderCoordinates(),
            this.renderPlaces(),
            this.renderLayers()
        ].filter(element => element);
        if(isEmpty(children)) {
            return null;
        }
        return (
            <div className="searchbox-results" onMouseDown={this.setPreventBlur}>
                {children}
            </div>
        );
    }
    setPreventBlur = (ev) => {
        this.preventBlur = true;
        setTimeout(() => {this.preventBlur = false; return false;}, 100);
    }
    killEvent = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
    }
    toggleSection = (key) => {
        let newCollapsedSections = {...this.state.collapsedSections};
        newCollapsedSections[key] = !newCollapsedSections[key];
        this.setState({collapsedSections: newCollapsedSections});
    }
    render() {
        let placeholder = LocaleUtils.getMessageById(this.context.messages, "searchbox.placeholder");
        return (
            <div className="SearchBox">
                <div className="searchbox-field">
                    <Icon icon="search" />
                    <input type="text" ref={el => this.searchBox = el}
                        placeholder={placeholder} value={this.state.searchText}
                        onPaste={ev => ev.target.setAttribute('__pasted', 1)}
                        onChange={ev => this.searchTextChanged(ev.target, ev.target.value)} onKeyDown={this.onKeyDown}
                        onFocus={this.onFocus} onBlur={this.onBlur} />
                    <Icon icon="remove" onClick={this.clear} />
                </div>
                {this.renderSearchResults()}
            </div>
        );
    }
    searchTextChanged = (el, text) => {
        let pasted = el.getAttribute('__pasted');
        el.removeAttribute('__pasted');
        if(this.props.layers.find(layer => layer.id === 'searchselection')) {
            this.props.removeLayer('searchselection');
        }
        this.setState({searchText: text, expandedLayerGroup: null, activeLayerInfo: null});
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout((ev) => this.startSearch(pasted), 250);
    }
    onFocus = () => {
        this.setState({resultsVisible: true});
        if(this.searchBox) {
            this.searchBox.select();
        }
    }
    onBlur = () => {
        if(this.preventBlur && this.searchBox) {
            this.searchBox.focus();
        } else {
            this.setState({resultsVisible: false, collapsedSections: {}, expandedLayerGroup: null, activeLayerInfo: null});
        }
    }
    onKeyDown = (ev) => {
        if(ev.keyCode === 27 && this.searchBox) {
            if(this.searchBox.selectionStart !== this.searchBox.selectionEnd) {
                this.searchBox.setSelectionRange(this.searchBox.value.length, this.searchBox.value.length);
            } else {
                this.searchBox.blur();
            }
        }
    }
    clear = () => {
        if(this.searchBox) {
            this.searchBox.blur();
        }
        this.setState({searchText: '', searchResults: {}});
        this.props.removeLayer('searchselection');
    }
    startSearch = (textWasPasted) => {
        console.log(textWasPasted);
        const service = ConfigUtils.getConfigProp("searchServiceUrl").replace(/\/$/g, "") + '/';
        let searchText = this.state.searchText.trim();
        if(isEmpty(searchText)) {
            this.setState({searchResults: {}});
            return;
        }
        let params = {
            searchtext: searchText,
            filter: this.props.searchFilter,
            limit: this.props.resultLimit
        };
        axios.get(service, {params}).then(response => {
            let searchResults = {...response.data, query_text: searchText};
            let nCoordinateResults = this.addCoordinateResults(searchText, searchResults.results);
            searchResults.tot_result_count = (searchResults.result_counts || []).reduce((res, entry) => res + (entry.count || 0), 0);
            this.setState({searchResults: searchResults});
            // If a single result is returned, select it immediately if it is a coordinate or feature result
            if(textWasPasted && searchResults.results.length === 1 && searchResults.tot_result_count + nCoordinateResults === 1) {
                if(searchResults.results[0].coordinate) {
                    this.selectCoordinateResult(searchResults.results[0].coordinate);
                    this.blur();
                } else if(searchResults.results[0].feature) {
                    this.selectFeatureResult(searchResults.results[0].feature);
                    this.blur();
                }
            }
        }).catch(e => {
            console.warn("Search failed: " + e);
            this.setState({searchResults: {}});
        })
    }
    addCoordinateResults = (text, results) => {
        let nResults = 0;
        let displaycrs = this.props.displaycrs || "EPSG:4326";
        let matches = text.replace(',', ' ').replace(/[^\w.-\s]/g, '').match(/^\s*([+-]?\d+\.?\d*)[,\s]\s*([+-]?\d+\.?\d*)\s*$/);
        if(matches && matches.length >= 3) {
            let x = parseFloat(matches[1]);
            let y = parseFloat(matches[2]);
            if(displaycrs !== "EPSG:4326") {
                let coord = CoordinatesUtils.reproject([x, y], displaycrs, "EPSG:4326");
                results.push({"coordinate": {
                    display: x + ", " + y + " (" + displaycrs + ")",
                    x: coord[0],
                    y: coord[1],
                    crs: "EPSG:4326"
                }});
                ++nResults;
            }
            if(x >= -180 && x <= 180 && y >= -90 && y <= 90) {
                let title = Math.abs(x) + (x >= 0 ? "°E" : "°W") + ", "
                          + Math.abs(y) + (y >= 0 ? "°N" : "°S");
                results.push({"coordinate": {
                    display: title,
                    x: x,
                    y: y,
                    crs: "EPSG:4326"
                }});
                ++nResults;
            }
            if(x >= -90 && x <= 90 && y >= -180 && y <= 180 && x != y) {
                let title = Math.abs(y) + (y >= 0 ? "°E" : "°W") + ", "
                          + Math.abs(x) + (x >= 0 ? "°N" : "°S");
                results.push({"coordinate": {
                    display: title,
                    x: y,
                    y: x,
                    crs: "EPSG:4326"
                }});
                ++nResults;
            }
        }
        return nResults;
    }
    updateRecentSearches = () => {
        if(!this.state.searchResults || !this.state.searchResults.query_text) {
            return;
        }
        let text = this.state.searchResults.query_text;
        if(!this.state.recentSearches.includes(text)) {
            this.setState({recentSearches: [text, ...this.state.recentSearches.slice(0, 4)]});
        }
    }
    blur = () => {
        if(this.searchBox) {
            this.searchBox.blur();
        }
    }
    selectCoordinateResult = (result, zoom=true) => {
        this.updateRecentSearches();
        if(zoom) {
            this.props.zoomToPoint([result.x, result.y], this.props.searchOptions.minScale, result.crs);
        } else {
            this.props.panTo([result.x, result.y], result.crs);
        }
        let feature = {
            geometry: {type: 'Point', coordinates: [result.x, result.y]},
            styleName: 'marker',
            crs: result.crs
        }
        let layer = {
            id: "searchselection",
            role: LayerRole.SELECTION
        };
        this.props.addLayerFeatures(layer, [feature], true);
        let c = CoordinatesUtils.reproject([result.x, result.y], result.crs, "EPSG:2056");
        UrlParams.updateParams({hp: undefined, hf: undefined, hc: c[0].toFixed(0) + "," + c[1].toFixed(0)});
    }
    selectFeatureResult = (result) => {
        this.updateRecentSearches();
        // URL example: /api/data/v1/ch.so.afu.fliessgewaesser.netz/?filter=[["gewissnr","=",1179]]
        let filter = `[["${result.id_field_name}","=",`;
        if (typeof(result.feature_id) === 'string') {
            filter += `"${result.feature_id}"]]`;
        } else {
            filter += `${result.feature_id}]]`;
        }
        const DATA_URL = ConfigUtils.getConfigProp("editServiceUrl").replace(/\/$/g, "");
        axios.get(DATA_URL + "/" + result.dataproduct_id + "/?filter=" + filter)
        .then(response => this.showFeatureGeometry(response.data));
        UrlParams.updateParams({hp: result.dataproduct_id, hf: filter, hc: undefined});
    }
    showFeatureGeometry = (data, scale=undefined) => {
        // Zoom to bbox
        let bbox = CoordinatesUtils.reprojectBbox(data.bbox, data.crs.properties.name, this.props.map.projection);
        let zoom = 0;
        if(scale) {
            zoom = MapUtils.computeZoom(this.props.map.scales, scale);
        } else {
            maxZoom = MapUtils.computeZoom(this.props.map.scales, this.props.searchOptions.minScale);
            zoom = Math.max(0, MapUtils.getZoomForExtent(bbox, this.props.map.resolutions, this.props.map.size, 0, maxZoom) - 1);
        }
        let x = 0.5 * (bbox[0] + bbox[2]);
        let y = 0.5 * (bbox[1] + bbox[3]);
        this.props.zoomToPoint([x, y], zoom, this.props.map.projection);

        // Add result geometry
        let layer = {
            id: "searchselection",
            role: LayerRole.SELECTION
        };
        this.props.addLayerFeatures(layer, data.features, true);

    }
    selectLayerResult = (result, info=false) => {
        if(!info) {
            this.updateRecentSearches();
        } else if(result.dataproduct_id in (this.state.activeLayerInfo || {})) {
            this.setState({activeLayerInfo: null});
            return;
        }
        const DATAPRODUCT_URL = ConfigUtils.getConfigProp("dataproductServiceUrl").replace(/\/$/g, "");
        let params = {
            filter: result.dataproduct_id
        };
        axios.get(DATAPRODUCT_URL + "/weblayers", {params}).then(response => {
            if(info) {
                this.setState({activeLayerInfo: response.data});
            } else {
                this.addLayer(result, response.data);
            }
        });
        UrlParams.updateParams({hp: undefined, hf: undefined, hc: undefined});
    }
    addLayer = (item, data) => {
        if(!isEmpty(data[item.dataproduct_id])) {
            this.props.addThemeSublayer({sublayers: data[item.dataproduct_id]});
            // Show layer tree to notify user that something has happened
            this.props.setCurrentTask('LayerTree');
        }
    }
};

const searchFilterSelector = createSelector([state => state.theme, state => state.layers.flat], (theme, layers) => {
    let searchFilter = [];
    // default filter from themes.json
    if(theme && theme.current) {
        let provider = theme.current.searchProviders.find(entry => entry.provider === "solr");
        if(provider) {
            searchFilter = provider.default;
        }
    }
    // searchterms of active layers
    for(let layer of layers) {
        if(layer.role === LayerRole.THEME) {
            for(let entry of LayerUtils.explodeLayers([layer])) {
                searchFilter = searchFilter.concat(entry.sublayer.searchterms || []);
            }
        }
    }
    return [...new Set(searchFilter)].join(",");
});

module.exports = connect(
    createSelector([state => state, searchFilterSelector, displayCrsSelector], (state, searchFilter, displaycrs) => ({
        map: state.map,
        layers: state.layers.flat,
        theme: state.theme.current,
        localConfig: state.localConfig,
        searchFilter: searchFilter,
        displaycrs: displaycrs
    })
), {
    addThemeSublayer: addThemeSublayer,
    addLayerFeatures: addLayerFeatures,
    removeLayer: removeLayer,
    setCurrentTask: setCurrentTask,
    zoomToPoint: zoomToPoint,
    panTo: panTo
})(SearchBox);
