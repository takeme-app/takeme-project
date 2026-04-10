import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { parseCoordPair } from '../lib/mapCoordUtils';
import { geocodeAddress } from '../lib/googleGeocoding';
import { getGoogleMapsApiKey } from '../lib/expoExtra';
import type { TripMapCoords } from './useTripMapCoords';

export type EncomendaMapCoordsInput = {
  scheduledTripId: string | null;
  originLat: number | null;
  originLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  originAddress: string;
  destinationAddress: string;
};

/**
 * Coordenadas para o mapa na edição de encomenda: linha da encomenda +, se houver viagem,
 * enriquecimento com `scheduled_trips` e `trip_stops` (igual fluxo de `useTripMapCoords`).
 */
export function useEncomendaMapCoords(input: EncomendaMapCoordsInput | null): TripMapCoords {
  const [coords, setCoords] = useState<TripMapCoords>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!input) {
        setCoords({});
        return;
      }

      let origin = parseCoordPair(input.originLat, input.originLng);
      let destination = parseCoordPair(input.destinationLat, input.destinationLng);
      const tripId = input.scheduledTripId;

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

      const oAddr = (input.originAddress || '').trim();
      const dAddr = (input.destinationAddress || '').trim();
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
    input?.scheduledTripId,
    input?.originLat,
    input?.originLng,
    input?.destinationLat,
    input?.destinationLng,
    input?.originAddress,
    input?.destinationAddress,
  ]);

  return coords;
}
