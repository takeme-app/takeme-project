import { NativeModules } from 'react-native';
import { registerRootComponent } from 'expo';

try {
  if (NativeModules.RNFBAppModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const messaging = require('@react-native-firebase/messaging').default;
    messaging().setBackgroundMessageHandler(async (remoteMessage: unknown) => {
      try {
        const { displayClienteRemoteMessage } = await import(
          './src/lib/foregroundNotificationHandler'
        );
        await displayClienteRemoteMessage(
          remoteMessage as import('@react-native-firebase/messaging').FirebaseMessagingTypes.RemoteMessage,
        );
      } catch {
        /* Notifee indisponível ou payload vazio */
      }
    });
  }
} catch {
  /* Web ou bundle sem nativo */
}

import App from './App';
registerRootComponent(App);
