export type LatLng = { latitude: number; longitude: number };

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

/**
 * Zoom bem próximo para “minha localização” / acompanhar GPS (delta menor = mais zoom).
 * Equivale a ~1 nível a mais que 0.002 em `regionToZoomLevel`.
 */
export const MY_LOCATION_NAV_DELTA = 0.00115;

/** Centro aproximado do Brasil — evita (0,0) no Atlântico quando não há GPS/coords. */
export const DEFAULT_MAP_REGION_BR: MapRegion = {
  latitude: -23.5505,
  longitude: -46.6333,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export function isValidGlobeCoordinate(lat: number, lng: number): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) < 1e-5 || Math.abs(lng) < 1e-5) return false;
  return lat >= -85 && lat <= 85 && lng >= -180 && lng <= 180;
}

/** Par lat/lng vindos do banco ou estado — rejeita null, NaN e (0,0). */
export function hasValidTripCoordinatePair(lat: unknown, lng: unknown): boolean {
  if (lat == null || lng == null) return false;
  const la = typeof lat === 'number' ? lat : Number(lat);
  const ln = typeof lng === 'number' ? lng : Number(lng);
  return isValidGlobeCoordinate(la, ln);
}

/** Deltas muito pequenos ou enormes quebram o cálculo da câmera no Google Maps (mapa cinza ou zoom estranho). */
const MIN_SPAN_DELTA = 0.002;
const MAX_LATITUDE_DELTA = 80;
const MAX_LONGITUDE_DELTA = 170;

function clampSpanDelta(latD: number, lngD: number, fallback: MapRegion): { latD: number; lngD: number } {
  let a = Number.isFinite(latD) && latD > 1e-6 ? latD : fallback.latitudeDelta;
  let b = Number.isFinite(lngD) && lngD > 1e-6 ? lngD : fallback.longitudeDelta;
  a = Math.min(Math.max(a, MIN_SPAN_DELTA), MAX_LATITUDE_DELTA);
  b = Math.min(Math.max(b, MIN_SPAN_DELTA), MAX_LONGITUDE_DELTA);
  return { latD: a, lngD: b };
}

export function sanitizeMapRegion(region: MapRegion, fallback: MapRegion = DEFAULT_MAP_REGION_BR): MapRegion {
  const { latitude: lat, longitude: lng, latitudeDelta: latD, longitudeDelta: lngD } = region;
  if (!isValidGlobeCoordinate(lat, lng)) return { ...fallback };
  const { latD: safeLatD, lngD: safeLngD } = clampSpanDelta(latD, lngD, fallback);
  return { latitude: lat, longitude: lng, latitudeDelta: safeLatD, longitudeDelta: safeLngD };
}

/** Região que engloba pontos válidos (ignora 0,0 e NaN). */
export function regionFromLatLngPoints(pts: LatLng[]): MapRegion {
  const valid = pts.filter((p) => isValidGlobeCoordinate(p.latitude, p.longitude));
  if (valid.length === 0) return { ...DEFAULT_MAP_REGION_BR };
  if (valid.length === 1) {
    const p = valid[0];
    const d = 0.06;
    return { latitude: p.latitude, longitude: p.longitude, latitudeDelta: d, longitudeDelta: d };
  }
  const lats = valid.map((p) => p.latitude);
  const lngs = valid.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.012);
  const lngSpan = Math.max(maxLng - minLng, 0.012);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.min(latSpan * 1.55, 2),
    longitudeDelta: Math.min(lngSpan * 1.55, 2),
  };
}

/** Número finito a partir do valor do banco / string (sempre via parseFloat). */
export function parseCoordNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function likelyBrazilLongitude(v: number): boolean {
  return v <= -32 && v >= -74;
}

function likelyBrazilLatitude(v: number): boolean {
  return v >= -33.5 && v <= 5.5;
}

/**
 * Corrige par vindo de `*_lat` / `*_lng` quando os valores foram gravados invertidos
 * (ex.: tratar tupla [lng,lat] como [lat,lng] nas colunas).
 */
export function latLngFromDbColumns(latRaw: unknown, lngRaw: unknown): LatLng | null {
  let lat = parseCoordNumber(latRaw);
  let lng = parseCoordNumber(lngRaw);
  if (lat == null || lng == null) return null;
  if (likelyBrazilLongitude(lat) && likelyBrazilLatitude(lng)) {
    const t = lat;
    lat = lng;
    lng = t;
  }
  if (Math.abs(lng) < 1e-6 || Math.abs(lat) < 1e-6) return null;
  if (lat < -85 || lat > 85 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

/** [longitude, latitude] (GeoJSON) a partir de um ponto, ou null se inválido. */
export function toLngLatPair(point: LatLng | null): [number, number] | null {
  if (!point) return null;
  const lng = parseCoordNumber(point.longitude);
  const lat = parseCoordNumber(point.latitude);
  if (lng == null || lat == null) return null;
  return [lng, lat];
}

/** [longitude, latitude] — versão que sempre retorna tupla (fallback nos valores crus). */
export function latLngToTuple(point: LatLng): [number, number] {
  const lng = parseCoordNumber(point.longitude);
  const lat = parseCoordNumber(point.latitude);
  return [lng ?? point.longitude, lat ?? point.latitude];
}

export function regionToZoomLevel(region: MapRegion): number {
  const { latitudeDelta } = region;
  const zoom = 14 - Math.log2(latitudeDelta / 0.008);
  return Math.round(Math.max(8, Math.min(20, zoom)));
}

/** Inverso aproximado de regionToZoomLevel para animateToRegion (Google Maps / react-native-maps). */
export function zoomLevelToLatitudeDelta(zoom: number): number {
  const z = Math.max(3, Math.min(20, Math.round(zoom)));
  return 0.008 * Math.pow(2, 14 - z);
}
