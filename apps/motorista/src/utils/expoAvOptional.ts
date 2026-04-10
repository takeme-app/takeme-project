import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * O `expo-av` usa `requireNativeModule('ExponentAV')` internamente.
 * Em builds Expo atuais o módulo **não** aparece em `ReactNative.NativeModules.ExponentAV`
 * (fica em `expo.modules` / TurboModule). Usamos a mesma API do core para não dar falso negativo.
 */
export function isExponentAvNativeLinked(): boolean {
  try {
    return requireOptionalNativeModule('ExponentAV') != null;
  } catch {
    return false;
  }
}

/**
 * Carrega expo-av só quando o nativo existe. Caso contrário devolve `null` (sem importar o pacote).
 */
export async function loadExpoAv(): Promise<typeof import('expo-av') | null> {
  if (!isExponentAvNativeLinked()) {
    return null;
  }
  try {
    return await import('expo-av');
  } catch {
    return null;
  }
}
