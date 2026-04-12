import type { SupabaseClient } from '@supabase/supabase-js';
import {
  coordsForScheduledTripFromRoute,
  computeNextDepartureArrivalFromWeekday,
  normalizeRouteTimeForSchedule,
} from './routeScheduleTimes';

export type CompletedRouteTripSnapshot = {
  route_id: string;
  day_of_week: number;
  departure_time: string | null;
  arrival_time: string | null;
  capacity: number;
  price_per_person_cents: number;
  origin_address: string;
  destination_address: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
};

/**
 * Após concluir uma viagem de rota (`route_id` preenchido), insere **nova** linha em
 * `scheduled_trips` (mesmo dia da semana e horários de janela), `status: active`, `confirmed_count: 0`
 * (aparece como planejada nas Atividades) e `is_active: true`. O cronograma só lista `active`/`scheduled`;
 * o switch continua a controlar `is_active` nessa nova viagem.
 */
export async function insertPlannedRouteSlotAfterComplete(
  client: SupabaseClient,
  driverId: string,
  snap: CompletedRouteTripSnapshot,
): Promise<void> {
  const dep = normalizeRouteTimeForSchedule(snap.departure_time);
  const arr = normalizeRouteTimeForSchedule(snap.arrival_time);
  if (!dep || !arr) return;

  let departureAt: Date;
  let arrivalAt: Date;
  try {
    const next = computeNextDepartureArrivalFromWeekday(snap.day_of_week, dep, arr);
    departureAt = next.departureAt;
    arrivalAt = next.arrivalAt;
  } catch {
    return;
  }

  const { data: routeData, error: routeErr } = await client
    .from('worker_routes')
    .select(
      'origin_address, destination_address, price_per_person_cents, origin_lat, origin_lng, destination_lat, destination_lng',
    )
    .eq('id', snap.route_id)
    .single();

  if (routeErr || !routeData) return;

  const r = routeData as {
    origin_address: string;
    destination_address: string;
    price_per_person_cents: number;
    origin_lat?: number | null;
    origin_lng?: number | null;
    destination_lat?: number | null;
    destination_lng?: number | null;
  };

  const geo = coordsForScheduledTripFromRoute({
    origin_lat: snap.origin_lat ?? r.origin_lat,
    origin_lng: snap.origin_lng ?? r.origin_lng,
    destination_lat: snap.destination_lat ?? r.destination_lat,
    destination_lng: snap.destination_lng ?? r.destination_lng,
  });

  const cap = Math.max(1, snap.capacity || 1);
  const price = Number.isFinite(snap.price_per_person_cents)
    ? snap.price_per_person_cents
    : r.price_per_person_cents;

  const { error } = await client.from('scheduled_trips').insert({
    driver_id: driverId,
    route_id: snap.route_id,
    day_of_week: snap.day_of_week,
    departure_time: dep,
    arrival_time: arr,
    departure_at: departureAt.toISOString(),
    arrival_at: arrivalAt.toISOString(),
    capacity: cap,
    seats_available: cap,
    bags_available: 0,
    confirmed_count: 0,
    is_active: true,
    status: 'active',
    origin_address: snap.origin_address?.trim() || r.origin_address,
    destination_address: snap.destination_address?.trim() || r.destination_address,
    price_per_person_cents: price,
    origin_lat: geo.origin_lat,
    origin_lng: geo.origin_lng,
    destination_lat: geo.destination_lat,
    destination_lng: geo.destination_lng,
  } as never);
  if (error) {
    console.warn('[insertPlannedRouteSlotAfterComplete]', error.message);
  }
}
