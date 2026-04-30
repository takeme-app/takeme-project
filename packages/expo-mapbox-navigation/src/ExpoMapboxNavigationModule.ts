import { requireNativeModule } from 'expo-modules-core';

import type { ExpoMapboxNavigationModuleType } from './ExpoMapboxNavigation.types';

/**
 * Stub seguro para quando o módulo nativo não está disponível (ex.: rodando no Expo Go,
 * web, ou primeiro `expo start` antes do `expo run:ios`/`expo run:android`).
 */
const fallback: ExpoMapboxNavigationModuleType = {
  isAvailable() {
    return false;
  },
  getSdkVersion() {
    return 'unavailable';
  },
};

let mod: ExpoMapboxNavigationModuleType;
try {
  mod = requireNativeModule<ExpoMapboxNavigationModuleType>('ExpoMapboxNavigation');
} catch {
  mod = fallback;
}

export default mod;
