import Constants from 'expo-constants';

/**
 * Lê `extra` do manifest (embed no build / dev client).
 * Não usar só process.env com chave dinâmica — o Metro não faz inline disso.
 */
function readExtra(key: string): string {
  const tryExtra = (extra: Record<string, unknown> | undefined | null): string => {
    if (!extra) return '';
    const v = extra[key];
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : '';
  };

  const fromExpoConfig = tryExtra(Constants.expoConfig?.extra as Record<string, unknown> | undefined);
  if (fromExpoConfig) return fromExpoConfig;

  const manifest = Constants.manifest as { extra?: Record<string, unknown> } | null;
  return tryExtra(manifest?.extra);
}

/**
 * Variáveis EXPO_PUBLIC_* precisam de acesso estático (`process.env.EXPO_PUBLIC_FOO`)
 * para o Metro/Expo embutirem o valor no bundle. `process.env[chave]` fica sempre vazio no device.
 */
export function getGoogleMapsApiKey(): string {
  const envVal = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (typeof envVal === 'string' && envVal.trim() !== '') {
    return envVal.trim();
  }
  return readExtra('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY');
}

/** Token Mapbox (SDK nativo + Directions REST). */
export function getMapboxAccessToken(): string {
  const envVal = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (typeof envVal === 'string' && envVal.trim() !== '') {
    return envVal.trim();
  }
  const typoEnv = process.env.EXPO_PUBLIC_MAPBOX_ACESS_TOKEN;
  if (typeof typoEnv === 'string' && typoEnv.trim() !== '') {
    return typoEnv.trim();
  }
  const fromExtra = readExtra('EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN');
  if (fromExtra) return fromExtra;
  return readExtra('EXPO_PUBLIC_MAPBOX_ACESS_TOKEN');
}
