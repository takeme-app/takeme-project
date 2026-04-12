import { loadClientScheduledTrips, compareTripsByDepartureAndBadge, type ClientScheduledTripItem } from './clientScheduledTrips';
import { sameShipmentRouteCoords } from './routeCoordsMatch';

/**
 * Motoristas com viagem agendada na mesma rota (origem+destino iguais), mesma ordenação da lista de viagens.
 */
export async function loadShipmentDriversForRoute(params: {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
}): Promise<{ items: ClientScheduledTripItem[]; error: string | null }> {
  const { items, error } = await loadClientScheduledTrips();
  if (error) return { items: [], error };
  const filtered = items.filter((t) =>
    sameShipmentRouteCoords(
      {
        originLat: params.originLat,
        originLng: params.originLng,
        destinationLat: params.destinationLat,
        destinationLng: params.destinationLng,
      },
      {
        originLat: t.origin_lat,
        originLng: t.origin_lng,
        destinationLat: t.latitude,
        destinationLng: t.longitude,
      }
    )
  );
  filtered.sort(compareTripsByDepartureAndBadge);
  return { items: filtered, error: null };
}
