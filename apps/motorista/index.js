/**
 * Entry point: polyfill primeiro (require não é hoisted), depois o app.
 */
require('./polyfillFormData.js');

const { registerRootComponent } = require('expo');
const App = require('./App').default;
registerRootComponent(App);
