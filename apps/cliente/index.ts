import { registerRootComponent } from 'expo';

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async () => {
    // Opcional: tratar remoteMessage em background (Android).
  });
} catch {
  /* Web ou bundle sem nativo */
}

import App from './App';
registerRootComponent(App);
