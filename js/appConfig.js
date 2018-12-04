/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

const Proj4js = require('proj4').default;
const assign = require('object-assign');
const {SearchProviders, searchProviderFactory} = require('./SearchProviders');
const EditingInterface = require('./EditingInterface');
const CoordinatesUtils = require('../qwc2/MapStore2Components/utils/CoordinatesUtils');
const renderHelp = require('./Help');

Proj4js.defs("EPSG:21781", "+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.4,15.1,405.3,0,0,0,0 +units=m +no_defs");
Proj4js.defs("EPSG:2056", "+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs");
Proj4js.defs("EPSG:25832", "+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

CoordinatesUtils.setCrsLabels({
    "EPSG:21781": "CH1903 / LV03",
    "EPSG:2056": "CH1903+ / LV95",
    "EPSG:25832": "ETRS89 / UTM 32N"
});

module.exports = {
    initialState: {
        defaultState: {
            mousePosition: {
                enabled: true
            }
        },
        mobile: {}
    },
    pluginsDef: {
        plugins: {
            MapPlugin: require('../qwc2/QWC2Components/plugins/Map')({
                EditingSupport: require('../qwc2/QWC2Components/plugins/map/EditingSupport'),
                MeasurementSupport: require('../qwc2/QWC2Components/plugins/map/MeasurementSupport'),
                LocateSupport: require('../qwc2/QWC2Components/plugins/map/LocateSupport'),
                RedliningSupport: require('../qwc2/QWC2Components/plugins/map/RedliningSupport'),
                ScaleBarSupport: require('../qwc2/QWC2Components/plugins/map/ScaleBarSupport'),
                SelectionSupport: require('../qwc2/QWC2Components/plugins/map/SelectionSupport'),
                CCCEditSupport: require('./plugins/CCCEditSupport')
            }),
            HomeButtonPlugin: require('../qwc2/QWC2Components/plugins/HomeButton'),
            LocateButtonPlugin: require('../qwc2/QWC2Components/plugins/LocateButton'),
            ZoomInPlugin: require('../qwc2/QWC2Components/plugins/ZoomButtons'),
            ZoomOutPlugin: require('../qwc2/QWC2Components/plugins/ZoomButtons'),
            BackgroundSwitcherPlugin: require('../qwc2/QWC2Components/plugins/BackgroundSwitcher'),
            TopBarPlugin: require('../qwc2/QWC2Components/plugins/TopBar')({
                 AppMenu: require("../qwc2/QWC2Components/components/AppMenu"),
                 Search: require("../qwc2/QWC2Components/components/Search")(SearchProviders, searchProviderFactory),
                 Toolbar: require("../qwc2/QWC2Components/components/Toolbar"),
                 FullscreenSwitcher: require("../qwc2/QWC2Components/components/FullscreenSwitcher")
            }),
            BottomBarPlugin: require('../qwc2/QWC2Components/plugins/BottomBar'),
            MeasurePlugin: require('../qwc2/QWC2Components/plugins/Measure'),
            ThemeSwitcherPlugin: require('../qwc2/QWC2Components/plugins/ThemeSwitcher'),
            LayerTreePlugin: require('../qwc2/QWC2Components/plugins/LayerTree'),
            IdentifyPlugin: require('../qwc2/QWC2Components/plugins/Identify'),
            MapTipPlugin: require('../qwc2/QWC2Components/plugins/MapTip'),
            SharePlugin: require('../qwc2/QWC2Components/plugins/Share'),
            MapCopyrightPlugin: require('../qwc2/QWC2Components/plugins/MapCopyright'),
            PrintPlugin: require('../qwc2/QWC2Components/plugins/Print'),
            HelpPlugin: require('../qwc2/QWC2Components/plugins/Help')(renderHelp),
            RasterExportPlugin: require('../qwc2/QWC2Components/plugins/RasterExport'),
            RedliningPlugin: require('../qwc2/QWC2Components/plugins/Redlining'),
            EditingPlugin: require('../qwc2/QWC2Components/plugins/Editing')(EditingInterface),
            MapComparePlugin: require('../qwc2/QWC2Components/plugins/MapCompare'),
            HeightProfilePlugin: require('../qwc2/QWC2Components/plugins/HeightProfile'),
            MapInfoTooltipPlugin: require('../qwc2/QWC2Components/plugins/MapInfoTooltip'),
            AuthenticationPlugin: require('../qwc2/QWC2Components/plugins/Authentication'),
            LandRegisterExtractPlugin: require('./plugins/LandRegisterExtract'),
            CCCInterfacePlugin: require('./plugins/CCCInterface')
        },
        cfg: {
            IdentifyPlugin: {
                attributeCalculator: require('./plugins/CCCInterface').CCCAttributeCalculator
            }
        }
    },
    actionLogger: (action, state) => {
        let blacklist = [
            'ADD_LAYER_FEATURES',
            'CHANGE_BROWSER_PROPERTIES',
            'CHANGE_LOCALE',
            'CHANGE_MAP_VIEW',
            'CHANGE_MEASUREMENT_STATE',
            'CHANGE_MOUSE_POSITION_STATE',
            'CLICK_ON_MAP',
            'IDENTIFY_EMPTY',
            'IDENTIFY_RESPONSE',
            'LOCAL_CONFIG_LOADED',
            'PURGE_IDENTIFY_RESULTS',
            'REMOVE_ALL_LAYERS',
            'REMOVE_LAYER_FEATURES',
            'REPLACE_PLACEHOLDER_LAYER',
            'RESTORE_LAYER_STATE',
            'SEARCH_ADD_RESULT',
            'SEARCH_CHANGE',
            'SET_LAYER_LOADING',
            'SET_CURRENT_TASK_BLOCKED',
            'SET_CURRENT_THEME',
            'SET_IDENTIFY_ENABLED',
            'THEMES_LOADED',
            'TOGGLE_FULLSCREEN'
        ];
        let alterations = {
            'SEARCH_SET_REQUEST': (action) => ({...action, text: state.search.text})
        };
        if(!blacklist.includes(action.type)) {
            let data = assign({}, action);
            delete data['type'];
            if(alterations[action.type]) {
                data = alterations[action.type](data);
            }
            _paq.push(['trackEvent', 'Action', action.type, JSON.stringify(data)]);
        }
    },
    themeLayerRestorer: require('./themeLayerRestorer'),
    supportedLocales: {
         "en": {
            code: "en-US",
            description: "English",
            localeData: require('react-intl/locale-data/en')
         },
        "de": {
            code: "de-CH",
            description: "Deutsch",
            localeData: require('react-intl/locale-data/de')
        }
   }
};
