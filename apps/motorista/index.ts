/**
 * Entrada alinhada ao app cliente (ESM): evita require() no App com Hermes + React 19.
 */
import './polyfillFormData.js';

import { NativeModules } from 'react-native';
import { registerRootComponent } from 'expo';
import App from './App';

try {
  if (NativeModules.RNFBAppModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const messaging = require('@react-native-firebase/messaging').default;
    messaging().setBackgroundMessageHandler(async () => {});
  }
} catch {
  /* Web ou bundle sem nativo */
}

registerRootComponent(App);
