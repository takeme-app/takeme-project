/**
 * Entry point: polyfill primeiro (require não é hoisted), depois o app.
 */
require('./polyfillFormData.js');

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async () => {});
} catch {
  /* Web ou bundle sem nativo */
}

const { registerRootComponent } = require('expo');
const App = require('./App').default;
registerRootComponent(App);
