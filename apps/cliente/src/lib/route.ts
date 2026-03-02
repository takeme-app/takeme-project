/**
 * Obtém a rota (geometria pelas ruas) entre dois pontos usando OSRM (Open Source Routing Machine).
 * Serviço público, sem API key. Para produção com alto volume, considere instância própria ou Google Directions.
 */

export type RoutePoint = { latitude: number; longitude: number };

/**
 * Retorna as coordenadas da rota de carro entre origem e destino, ou null se falhar.
 * Formato pronto para MapboxPolyline / polylines no mapa.
 */
export async function getRoutePolyline(
  origin: RoutePoint,
  destination: RoutePoint
): Promise<RoutePoint[] | null> {
  const [lng1, lat1] = [origin.longitude, origin.latitude];
  const [lng2, lat2] = [destination.longitude, destination.latitude];
  const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TakeMe-Cliente/1.0 (mobile app)' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
    };
    const coords = data.routes?.[0]?.geometry?.coordinates;
    if (!coords?.length) return null;
    return coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  } catch {
    return null;
  }
}
