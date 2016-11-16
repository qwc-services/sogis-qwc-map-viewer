/**
 * Copyright 2016, Sourcepole AG.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const React = require('react');
const ReactDOM = require('react-dom');
const {connect} = require('react-redux');
require("babel-polyfill"); // Needed for IE11 to avoid 'Promise not defined' error in axios

const {initialState, pluginsDef} = require('./appConfig');
const Localized = require('../qwc2/MapStore2/web/client/components/I18N/Localized');
const Main = require('./Main');

const StandardApp = require('../qwc2/MapStore2/web/client/components/app/StandardApp');
const StandardStore = require('../qwc2/MapStore2/web/client/stores/StandardStore').bind(null, initialState, {});

const appComponent = React.createClass({
    propTypes: {
        plugins: React.PropTypes.object,
        locale: React.PropTypes.object,
    },
    render() {
        return (
            <Localized messages={this.props.locale.messages} locale={this.props.locale.current} loadingError={this.props.locale.localeError}>
                <Main plugins={this.props.plugins}/>
            </Localized>
        );
    }
});

const appConfig = {
    storeOpts: {},
    appStore: StandardStore,
    pluginsDef: pluginsDef,
    initialActions: [],
    appComponent: connect(state => ({
        locale: state.locale || {messages: {}, current: ''}
    }))(appComponent)
};

ReactDOM.render(
    <StandardApp {...appConfig}/>,
    document.getElementById('container')
);
