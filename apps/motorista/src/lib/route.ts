export type RoutePoint = { latitude: number; longitude: number };

export type RouteResult = {
  coordinates: RoutePoint[];
  /** Duração estimada em segundos. */
  durationSeconds: number;
};

export type RouteWithDurationOptions = {
  /** Google Directions API (ative no Cloud Console). */
  googleMapsApiKey?: string;
  /** Token Mapbox — Directions v5. Tentado antes do Google e OSRM. */
  mapboxToken?: string;
};

function parseRoutePoint(p: RoutePoint): { lat: number; lng: number } | null {
  const lat = parseFloat(String(p.latitude));
  const lng = parseFloat(String(p.longitude));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Decodifica polyline codificada (Google Directions). */
function decodeGooglePolyline(encoded: string): RoutePoint[] {
  const points: RoutePoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

/** Rota de carro via Mapbox Directions v5. Suporta 2+ waypoints no mesmo formato do admin. */
async function fetchMapboxDrivingRoute(
  points: Array<{ lat: number; lng: number }>,
  token: string,
): Promise<RouteResult | null> {
  if (points.length < 2) return null;
  const coordPath = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordPath}` +
    `?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TakeMe-Motorista/1.0' } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{
        geometry?: { type?: string; coordinates?: [number, number][] };
        duration?: number;
      }>;
    };
    if (data.code !== 'Ok' || !data.routes?.[0]?.geometry) return null;
    const route = data.routes[0];
    const coords = route.geometry?.coordinates;
    if (!coords?.length) return null;
    return {
      coordinates: coords.map(([lng, lat]) => ({
        latitude: parseFloat(String(lat)),
        longitude: parseFloat(String(lng)),
      })),
      durationSeconds: route.duration ?? 0,
    };
  } catch {
    return null;
  }
}

type DirectionsResponse = {
  status?: string;
  routes?: Array<{
    overview_polyline?: { points?: string };
    legs?: Array<{ duration?: { value?: number } }>;
  }>;
};

async function fetchGoogleDrivingRoute(
  origin: string,
  destination: string,
  waypoints: string | undefined,
  apiKey: string,
): Promise<RouteResult | null> {
  let url =
    `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}&mode=driving&language=pt` +
    `&key=${encodeURIComponent(apiKey)}`;
  if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TakeMe-Motorista/1.0' } });
    if (!res.ok) return null;
    const data = (await res.json()) as DirectionsResponse;
    if (data.status !== 'OK' || !data.routes?.[0]) return null;
    const route = data.routes[0];
    const encoded = route.overview_polyline?.points;
    if (!encoded) return null;
    const coordinates = decodeGooglePolyline(encoded);
    if (!coordinates.length) return null;
    let durationSeconds = 0;
    for (const leg of route.legs ?? []) {
      durationSeconds += leg.duration?.value ?? 0;
    }
    return { coordinates, durationSeconds };
  } catch {
    return null;
  }
}

/** Rota de carro: Google Directions (com chave) ou OSRM público como fallback. */
export async function getRouteWithDuration(
  origin: RoutePoint,
  destination: RoutePoint,
  options?: RouteWithDurationOptions,
): Promise<RouteResult | null> {
  const a = parseRoutePoint(origin);
  const b = parseRoutePoint(destination);
  if (!a || !b) return null;

  const mapboxToken = options?.mapboxToken?.trim();
  if (mapboxToken) {
    const m = await fetchMapboxDrivingRoute([a, b], mapboxToken);
    if (m) return m;
  }

  const key = options?.googleMapsApiKey?.trim();
  if (key) {
    const originStr = `${a.lat},${a.lng}`;
    const destStr = `${b.lat},${b.lng}`;
    const g = await fetchGoogleDrivingRoute(originStr, destStr, undefined, key);
    if (g) return g;
  }

  const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TakeMe-Motorista/1.0' } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: { geometry?: { coordinates?: [number, number][] }; duration?: number }[];
    };
    const route = data.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!coords?.length) return null;
    return {
      coordinates: coords.map(([lng, lat]) => ({
        latitude: parseFloat(String(lat)),
        longitude: parseFloat(String(lng)),
      })),
      durationSeconds: route?.duration ?? 0,
    };
  } catch {
    return null;
  }
}

/** Rota de carro passando por múltiplos waypoints. */
export async function getMultiPointRoute(
  points: RoutePoint[],
  options?: RouteWithDurationOptions,
): Promise<RouteResult | null> {
  if (points.length < 2) return null;
  const parsed = points.map(parseRoutePoint);
  if (parsed.some((p) => !p)) return null;

  const mapboxToken = options?.mapboxToken?.trim();
  if (mapboxToken) {
    const m = await fetchMapboxDrivingRoute(parsed as Array<{ lat: number; lng: number }>, mapboxToken);
    if (m) return m;
  }

  const key = options?.googleMapsApiKey?.trim();
  if (key && parsed.length >= 2) {
    const first = parsed[0]!;
    const last = parsed[parsed.length - 1]!;
    const originStr = `${first.lat},${first.lng}`;
    const destStr = `${last.lat},${last.lng}`;
    let waypoints: string | undefined;
    if (parsed.length > 2) {
      waypoints = parsed
        .slice(1, -1)
        .map((p) => `${p!.lat},${p!.lng}`)
        .join('|');
    }
    const g = await fetchGoogleDrivingRoute(originStr, destStr, waypoints, key);
    if (g) return g;
  }

  const parts = parsed.map((p) => `${p!.lng},${p!.lat}`);
  const waypoints = parts.join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TakeMe-Motorista/1.0' } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: { geometry?: { coordinates?: [number, number][] }; duration?: number }[];
    };
    const route = data.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!coords?.length) return null;
    return {
      coordinates: coords.map(([lng, lat]) => ({
        latitude: parseFloat(String(lat)),
        longitude: parseFloat(String(lng)),
      })),
      durationSeconds: route?.duration ?? 0,
    };
  } catch {
    return null;
  }
}

export function formatEta(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
