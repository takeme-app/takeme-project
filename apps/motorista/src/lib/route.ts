export type RoutePoint = { latitude: number; longitude: number };

export type RouteResult = {
  coordinates: RoutePoint[];
  /** Duração estimada em segundos. */
  durationSeconds: number;
};

/** Rota de carro entre dois pontos (OSRM público, sem API key). */
export async function getRouteWithDuration(
  origin: RoutePoint,
  destination: RoutePoint,
): Promise<RouteResult | null> {
  const [lng1, lat1] = [origin.longitude, origin.latitude];
  const [lng2, lat2] = [destination.longitude, destination.latitude];
  const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TakeMe-Motorista/1.0' } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: Array<{ geometry?: { coordinates?: [number, number][] }; duration?: number }>;
    };
    const route = data.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!coords?.length) return null;
    return {
      coordinates: coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
      durationSeconds: route?.duration ?? 0,
    };
  } catch {
    return null;
  }
}

/** Rota de carro passando por múltiplos waypoints. */
export async function getMultiPointRoute(points: RoutePoint[]): Promise<RouteResult | null> {
  if (points.length < 2) return null;
  const waypoints = points.map((p) => `${p.longitude},${p.latitude}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TakeMe-Motorista/1.0' } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: Array<{ geometry?: { coordinates?: [number, number][] }; duration?: number }>;
    };
    const route = data.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!coords?.length) return null;
    return {
      coordinates: coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
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
