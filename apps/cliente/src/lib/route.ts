/**
 * Rota entre dois pontos: Mapbox Directions (se houver token) e OSRM público como reserva.
 * O OSRM público costuma ser lento ou instável; sem timeout a UI ficava sem polyline por muito tempo.
 */

export type RoutePoint = { latitude: number; longitude: number };

export type RouteResult = {
  coordinates: RoutePoint[];
  /** Duração estimada em segundos. */
  durationSeconds: number;
  /** Distância da rota em metros (OSRM), quando disponível. */
  distanceMeters?: number;
};

const OSRM_TIMEOUT_MS = 10_000;
const MAPBOX_TIMEOUT_MS = 15_000;

async function fetchJsonWithTimeout<T>(url: string, timeoutMs: number, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Polyline precision 6 (Mapbox / OSRM poly). */
function decodePolyline6(encoded: string): RoutePoint[] {
  const coordinates: RoutePoint[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  const factor = 1e6;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push({ latitude: lat / factor, longitude: lng / factor });
  }
  return coordinates;
}

/** OSRM / Mapbox Directions v5: `routes[0].geometry` como LineString ou string polyline6. */
function parseDirectionsStyleRoute(data: unknown): RouteResult | null {
  const route = (data as { routes?: Array<{ geometry?: unknown; duration?: number; distance?: number }> })?.routes?.[0];
  if (!route) return null;

  const g = route.geometry;
  if (g && typeof g === 'object' && !Array.isArray(g)) {
    const geom = g as { type?: string; coordinates?: [number, number][] };
    if (geom.type === 'LineString' && Array.isArray(geom.coordinates) && geom.coordinates.length) {
      return {
        coordinates: geom.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
        durationSeconds: route.duration ?? 0,
        distanceMeters: typeof route.distance === 'number' ? route.distance : undefined,
      };
    }
  }

  if (typeof g === 'string' && g.length > 0) {
    const decoded = decodePolyline6(g);
    if (decoded.length) {
      return {
        coordinates: decoded,
        durationSeconds: route.duration ?? 0,
        distanceMeters: typeof route.distance === 'number' ? route.distance : undefined,
      };
    }
  }

  return null;
}

/**
 * Retorna as coordenadas da rota de carro entre origem e destino, ou null se falhar.
 * Formato pronto para MapboxPolyline / polylines no mapa.
 */
export async function getRoutePolyline(
  origin: RoutePoint,
  destination: RoutePoint
): Promise<RoutePoint[] | null> {
  const result = await getRouteWithDuration(origin, destination);
  return result?.coordinates ?? null;
}

/**
 * Mapbox Directions (mesmo token do app). Preferido quando o token existe — costuma ser mais rápido que o OSRM público.
 */
async function getRouteWithDurationMapbox(
  origin: RoutePoint,
  destination: RoutePoint
): Promise<RouteResult | null> {
  const token = (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '').trim();
  if (!token) return null;
  const [lng1, lat1] = [origin.longitude, origin.latitude];
  const [lng2, lat2] = [destination.longitude, destination.latitude];
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${lng1},${lat1};${lng2},${lat2}?alternatives=false&geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(token)}`;

  const data = await fetchJsonWithTimeout<unknown>(url, MAPBOX_TIMEOUT_MS);
  if (!data) return null;
  return parseDirectionsStyleRoute(data);
}

async function getRouteWithDurationOsrm(
  origin: RoutePoint,
  destination: RoutePoint
): Promise<RouteResult | null> {
  const [lng1, lat1] = [origin.longitude, origin.latitude];
  const [lng2, lat2] = [destination.longitude, destination.latitude];
  const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;

  const data = await fetchJsonWithTimeout<unknown>(url, OSRM_TIMEOUT_MS, {
    headers: { 'User-Agent': 'TakeMe-Cliente/1.0 (mobile app)' },
  });
  if (!data) return null;
  return parseDirectionsStyleRoute(data);
}

/**
 * Retorna coordenadas + duração estimada da rota de carro, ou null se falhar.
 * Com token Mapbox: tenta Mapbox primeiro, depois OSRM (com timeout).
 * Sem token: só OSRM (timeout), depois Mapbox (no-op).
 */
export async function getRouteWithDuration(
  origin: RoutePoint,
  destination: RoutePoint
): Promise<RouteResult | null> {
  const token = (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '').trim();

  if (token) {
    const mb = await getRouteWithDurationMapbox(origin, destination);
    if (mb?.coordinates?.length) return mb;
    const os = await getRouteWithDurationOsrm(origin, destination);
    if (os?.coordinates?.length) return os;
    return null;
  }

  const os = await getRouteWithDurationOsrm(origin, destination);
  if (os?.coordinates?.length) return os;
  return getRouteWithDurationMapbox(origin, destination);
}

/** Formata segundos em texto amigável (ex: "5 min", "1h 20min"). */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/** Distância em linha de rota (metros) → texto km. */
export function formatDistanceKmLabel(meters: number | undefined): string {
  if (meters == null || !Number.isFinite(meters) || meters <= 0) return '—';
  const km = meters / 1000;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
