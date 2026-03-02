/**
 * Configuração do Expo com suporte a variáveis de ambiente.
 * Usado pelo EAS Build: EXPO_PUBLIC_* e segredos são injetados no build.
 */
const appJson = require('./app.json');

const expo = {
  ...appJson.expo,
  ios: {
    ...appJson.expo.ios,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  plugins: [
    ...(appJson.expo.plugins || []),
    'expo-font',
    ['@rnmapbox/maps'],
  ],
  android: {
    ...appJson.expo.android,
    config: {
      ...(appJson.expo.android?.config || {}),
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
      },
    },
  },
};

module.exports = { expo };
