/**
 * Entry point: polyfill primeiro (require não é hoisted), depois o app.
 */
require('./polyfillFormData.js');

/** Só carrega Firebase se o nativo existir (evita crash no simulador / dev client sem `expo run:ios`). */
try {
  const { NativeModules } = require('react-native');
  if (!NativeModules.RNFBAppModule) {
    /* Sem pods / build antigo — app sobe sem FCM em background */
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const messaging = require('@react-native-firebase/messaging').default;
    messaging().setBackgroundMessageHandler(async () => {});
  }
} catch {
  /* Web ou bundle sem nativo */
}

const { registerRootComponent } = require('expo');
const App = require('./App').default;
registerRootComponent(App);
