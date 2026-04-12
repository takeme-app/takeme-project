/** Distância em metros entre dois pontos WGS84 (fórmula de haversine). */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Mesma rota para efeito de envio / fila de motoristas: origem e destino próximos o suficiente
 * (geocodificação do cliente vs pontos gravados na viagem costumam diferir centenas de metros).
 */
export function sameShipmentRouteCoords(
  a: { originLat: number; originLng: number; destinationLat: number; destinationLng: number },
  b: { originLat: number; originLng: number; destinationLat: number; destinationLng: number },
  maxEndpointMeters = 1500
): boolean {
  return (
    haversineDistanceMeters(a.originLat, a.originLng, b.originLat, b.originLng) <= maxEndpointMeters &&
    haversineDistanceMeters(a.destinationLat, a.destinationLng, b.destinationLat, b.destinationLng) <=
      maxEndpointMeters
  );
}
