/**
 * Obtém a rota (geometria pelas ruas) entre dois pontos usando OSRM (Open Source Routing Machine).
 * Serviço público, sem API key. Para produção com alto volume, considere instância própria ou Google Directions.
 */

export type RoutePoint = { latitude: number; longitude: number };

export type RouteResult = {
  coordinates: RoutePoint[];
  /** Duração estimada em segundos. */
  durationSeconds: number;
};

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
 * Retorna coordenadas + duração estimada da rota de carro, ou null se falhar.
 */
export async function getRouteWithDuration(
  origin: RoutePoint,
  destination: RoutePoint
): Promise<RouteResult | null> {
  const [lng1, lat1] = [origin.longitude, origin.latitude];
  const [lng2, lat2] = [destination.longitude, destination.latitude];
  const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TakeMe-Cliente/1.0 (mobile app)' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: Array<{
        geometry?: { coordinates?: [number, number][] };
        duration?: number;
      }>;
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

/** Formata segundos em texto amigável (ex: "5 min", "1h 20min"). */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
