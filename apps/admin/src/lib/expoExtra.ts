import Constants from 'expo-constants';

export type AdminExpoExtra = {
  mapboxAccessToken?: string;
  googleMapsApiKey?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

export function getExpoExtra(): AdminExpoExtra {
  return (Constants.expoConfig?.extra as AdminExpoExtra) ?? {};
}

/** Token Mapbox: extra (build) ou process.env (Metro local). */
export function getMapboxAccessToken(): string {
  const e = getExpoExtra();
  const raw =
    (e.mapboxAccessToken && String(e.mapboxAccessToken)) ||
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN) ||
    '';
  return raw.trim();
}

/** Chave APIs Google (Places + Geocoding) — restrinja por referrer no console Google. */
export function getGoogleMapsApiKey(): string {
  const e = getExpoExtra();
  return (
    (e.googleMapsApiKey && String(e.googleMapsApiKey)) ||
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) ||
    ''
  );
}
