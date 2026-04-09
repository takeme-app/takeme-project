import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { supabase } from '../lib/supabase';
import type { BookingDetailForAdmin } from '../data/types';
import { parseCoordPair } from '../lib/mapCoordUtils';
import { geocodeAddress } from '../lib/googleGeocoding';
import { getGoogleMapsApiKey } from '../lib/expoExtra';

export type TripMapCoords = {
  origin?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  /** Partida da viagem agendada (`scheduled_trips.origin_*`) — costuma ser o ponto do motorista, distinto do embarque do passageiro. */
  vehicleOrigin?: { lat: number; lng: number };
};

/**
 * Coordenadas para o mapa: `bookings` → `scheduled_trips` → Geocoding Google (se chave configurada).
 */
export function useTripMapCoords(detail: BookingDetailForAdmin | null): [TripMapCoords, Dispatch<SetStateAction<TripMapCoords>>] {
  const [coords, setCoords] = useState<TripMapCoords>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!detail) {
        setCoords({});
        return;
      }

      let origin = parseCoordPair(detail.originLat, detail.originLng);
      let destination = parseCoordPair(detail.destinationLat, detail.destinationLng);
      const tripId = detail.listItem.tripId;

      let vehicleOrigin: { lat: number; lng: number } | undefined;
      if (tripId) {
        const { data } = await (supabase as any)
          .from('scheduled_trips')
          .select('origin_lat, origin_lng, destination_lat, destination_lng')
          .eq('id', tripId)
          .maybeSingle();
        if (!cancelled && data) {
          vehicleOrigin = parseCoordPair(data.origin_lat, data.origin_lng) ?? undefined;
          if (!origin) origin = vehicleOrigin;
          if (!destination) destination = parseCoordPair(data.destination_lat, data.destination_lng);
        }

        // Fallback a paradas persistidas (booking por vezes sem lat/lng; destino final na linha trip_destination).
        if (!cancelled && (!origin || !destination)) {
          const { data: stopRows } = await (supabase as any)
            .from('trip_stops')
            .select('stop_type, lat, lng')
            .eq('scheduled_trip_id', tripId);
          const rows = (stopRows || []) as Array<{ stop_type?: string; lat?: unknown; lng?: unknown }>;
          if (!origin) {
            const pu = rows.find(
              (r) =>
                String(r.stop_type ?? '') === 'passenger_pickup' ||
                String(r.stop_type ?? '') === 'passenger_dropoff',
            );
            const ll = pu ? parseCoordPair(pu.lat, pu.lng) : undefined;
            if (ll) origin = ll;
          }
          if (!destination) {
            const td = rows.find((r) => String(r.stop_type ?? '') === 'trip_destination');
            const ll = td ? parseCoordPair(td.lat, td.lng) : undefined;
            if (ll) destination = ll;
          }
        }
      }

      let next: TripMapCoords = { origin, destination, vehicleOrigin };
      if (!cancelled) setCoords(next);

      const key = getGoogleMapsApiKey();
      if (!key || cancelled) return;

      const oAddr = (detail.originFull || detail.listItem.origem || '').trim();
      const dAddr = (detail.destinationFull || detail.listItem.destino || '').trim();
      const patch: TripMapCoords = {};

      if (!next.origin && oAddr) {
        const r = await geocodeAddress(oAddr);
        if (!cancelled && r) patch.origin = { lat: r.lat, lng: r.lng };
      }
      if (!next.destination && dAddr) {
        const r = await geocodeAddress(dAddr);
        if (!cancelled && r) patch.destination = { lat: r.lat, lng: r.lng };
      }

      if (!cancelled && (patch.origin || patch.destination)) {
        setCoords((c) => ({ ...c, ...patch }));
      }
    })();

    return () => { cancelled = true; };
  }, [
    detail?.listItem.bookingId,
    detail?.listItem.tripId,
    detail?.originLat,
    detail?.originLng,
    detail?.destinationLat,
    detail?.destinationLng,
    detail?.originFull,
    detail?.destinationFull,
    detail?.listItem.origem,
    detail?.listItem.destino,
  ]);

  return [coords, setCoords];
}
