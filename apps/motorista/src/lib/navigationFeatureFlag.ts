import Constants from 'expo-constants';
import { ExpoMapboxNavigation } from '@take-me/expo-mapbox-navigation';

/**
 * Feature flag que decide entre a navegação caseira (JS — `<GoogleMapsMap>` +
 * dead-reckoning + reroute caseiro) e o `<ExpoMapboxNavigationView>` nativo.
 *
 * Estratégia de avaliação (na ordem):
 *   1. `process.env.EXPO_PUBLIC_USE_NATIVE_NAVIGATION` (entra no bundle estático).
 *   2. `Constants.expoConfig?.extra?.EXPO_PUBLIC_USE_NATIVE_NAVIGATION` (manifest EAS / dev client).
 *   3. Default do `app.config.js`: `'1'` no app motorista.
 *
 * Truthy: `'1'`, `'true'`, `'yes'`. Use `'0'` para forçar o mapa legado.
 *
 * Se o módulo nativo não estiver disponível (Expo Go, web, primeiro `expo start`
 * antes do rebuild), retorna `false` mesmo se o flag estiver ligado, para
 * evitar tela cinza.
 */
function readFlag(): boolean {
  const truthy = (v: unknown): boolean => {
    if (typeof v !== 'string') return false;
    const t = v.trim().toLowerCase();
    return t === '1' || t === 'true' || t === 'yes';
  };

  if (truthy(process.env.EXPO_PUBLIC_USE_NATIVE_NAVIGATION)) return true;

  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  if (truthy(extra?.EXPO_PUBLIC_USE_NATIVE_NAVIGATION)) return true;

  return false;
}

let cached: boolean | null = null;

/** Retorna `true` quando o app deve usar o `<ExpoMapboxNavigationView>` nativo. */
export function useNativeNavigationEnabled(): boolean {
  if (cached !== null) return cached;
  const flagOn = readFlag();
  if (!flagOn) {
    cached = false;
    return false;
  }
  // Mesmo com flag ligada, só ativamos se o módulo nativo estiver de pé.
  // `isAvailable()` retorna `false` em Expo Go / web / build sem rebuild.
  let available = false;
  try {
    available = ExpoMapboxNavigation.isAvailable();
  } catch {
    available = false;
  }
  cached = available;
  return available;
}

/** Reset do cache — útil em testes. */
export function _resetNavigationFeatureFlagCache(): void {
  cached = null;
}
