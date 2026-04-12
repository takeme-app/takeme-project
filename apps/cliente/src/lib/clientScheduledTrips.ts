import { supabase } from './supabase';
import { getUserErrorMessage } from '../utils/errorMessage';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toTimeString().slice(0, 5);
}

/** Preço exibido e usado no checkout: rota (worker_routes) > coluna na viagem > amount_cents legado. */
export function resolveTripPriceCents(
  trip: {
    route_id?: string | null;
    price_per_person_cents?: number | null;
    amount_cents?: number | null;
  },
  routePriceById: Map<string, number | null>
): number | null {
  const routeId = trip.route_id;
  if (routeId && routePriceById.has(routeId)) {
    const fromRoute = routePriceById.get(routeId);
    if (fromRoute != null && fromRoute >= 0) return fromRoute;
  }
  const tripPpp = trip.price_per_person_cents;
  if (tripPpp != null && tripPpp >= 0) return tripPpp;
  const legacy = trip.amount_cents;
  if (legacy != null && legacy >= 0) return legacy;
  return null;
}

/**
 * Lê `scheduled_trips` + `worker_routes` e devolve o mesmo preço que a lista usa.
 * Usar no checkout ao gravar `bookings.amount_cents` (não confiar só nos params de navegação).
 */
export async function fetchResolvedPriceCentsForScheduledTrip(
  scheduledTripId: string
): Promise<{ cents: number | null; error: string | null }> {
  const sb = supabase as { from: (table: string) => any };
  const { data: trip, error: tripErr } = await sb
    .from('scheduled_trips')
    .select('route_id, price_per_person_cents, amount_cents')
    .eq('id', scheduledTripId)
    .maybeSingle();
  if (tripErr) {
    return { cents: null, error: getUserErrorMessage(tripErr, 'Não foi possível obter os dados da viagem.') };
  }
  if (!trip) {
    return { cents: null, error: 'Viagem não encontrada.' };
  }
  const routeId = trip.route_id as string | null | undefined;
  const routePriceById = new Map<string, number | null>();
  if (routeId) {
    const { data: route, error: routeErr } = await sb
      .from('worker_routes')
      .select('id, price_per_person_cents')
      .eq('id', routeId)
      .eq('is_active', true)
      .maybeSingle();
    if (routeErr) {
      return { cents: null, error: getUserErrorMessage(routeErr, 'Não foi possível obter o preço da rota.') };
    }
    if (route) {
      routePriceById.set(route.id as string, (route.price_per_person_cents as number | null) ?? null);
    }
  }
  const cents = resolveTripPriceCents(
    {
      route_id: trip.route_id as string | null | undefined,
      price_per_person_cents: trip.price_per_person_cents as number | null | undefined,
      amount_cents: trip.amount_cents as number | null | undefined,
    },
    routePriceById
  );
  return { cents, error: null };
}

export type ClientScheduledTripItem = {
  id: string;
  driver_id: string;
  title: string;
  driverName: string;
  driverAvatarUrl: string | null;
  rating: number;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_plate: string | null;
  /** Capacidade máxima de passageiros do veículo (quando cadastrada), para exibir/validar oferta. */
  vehicle_passenger_capacity: number | null;
  badge: string;
  departure: string;
  arrival: string;
  seats: number;
  bags: number;
  latitude: number;
  longitude: number;
  origin_lat: number;
  origin_lng: number;
  amount_cents: number | null;
  departure_at: string;
};

type ScheduledTripRow = {
  id: string;
  title?: string | null;
  driver_id: string;
  route_id?: string | null;
  origin_address?: string | null;
  origin_lat: number;
  origin_lng: number;
  destination_address?: string | null;
  destination_lat: number;
  destination_lng: number;
  departure_at: string;
  arrival_at: string;
  seats_available: number;
  bags_available: number;
  capacity?: number | null;
  badge?: string | null;
  amount_cents?: number | null;
  price_per_person_cents?: number | null;
};

/**
 * Ordenação de negócio: horário de saída (origem) crescente; em empate, motoristas Take Me antes dos demais.
 */
export function compareTripsByDepartureAndBadge(a: ClientScheduledTripItem, b: ClientScheduledTripItem): number {
  const ta = new Date(a.departure_at).getTime();
  const tb = new Date(b.departure_at).getTime();
  if (ta !== tb) return ta - tb;
  const rank = (x: ClientScheduledTripItem) => (x.badge === 'Take Me' ? 0 : 1);
  return rank(a) - rank(b);
}

/** Indica se a oferta comporta passageiros e malas pedidos (lugares/malas restantes na viagem). */
export function tripFitsPassengersAndBags(
  trip: Pick<ClientScheduledTripItem, 'seats' | 'bags'>,
  passengerCount: number,
  bagsCount: number
): boolean {
  const p = Math.max(1, Math.floor(passengerCount));
  const b = Math.max(0, Math.floor(bagsCount));
  return trip.seats >= p && trip.bags >= b;
}

export async function loadClientScheduledTrips(): Promise<{
  items: ClientScheduledTripItem[];
  error: string | null;
}> {
  const sb = supabase as { from: (table: string) => any };
  const nowIso = new Date().toISOString();
  const { data: tripsRaw, error: tripsErr } = await sb
    .from('scheduled_trips')
    .select(
      'id, title, driver_id, route_id, origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng, departure_at, arrival_at, seats_available, bags_available, capacity, badge, amount_cents, price_per_person_cents'
    )
    .eq('status', 'active')
    .eq('is_active', true)
    .is('driver_journey_started_at', null)
    .gt('departure_at', nowIso)
    .gt('seats_available', 0)
    .order('departure_at');
  if (tripsErr) {
    return { items: [], error: getUserErrorMessage(tripsErr, 'Não foi possível carregar as viagens.') };
  }
  const trips = (tripsRaw ?? []) as ScheduledTripRow[];
  if (!trips.length) return { items: [], error: null };

  const driverIds = [...new Set(trips.map((t) => t.driver_id))];
  const routeIds = [...new Set(trips.map((t) => t.route_id).filter((id): id is string => Boolean(id)))];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, rating, avatar_url')
    .in('id', driverIds);

  const routePriceById = new Map<string, number | null>();
  if (routeIds.length > 0) {
    const { data: routesRaw } = await sb.from('worker_routes')
      .select('id, price_per_person_cents')
      .in('id', routeIds)
      .eq('is_active', true);
    for (const r of routesRaw ?? []) {
      routePriceById.set(r.id as string, (r.price_per_person_cents as number | null) ?? null);
    }
  }

  type VehicleRow = {
    worker_id: string;
    model: string;
    year: number;
    plate: string;
    passenger_capacity: number | null;
  };
  const { data: vehiclesRaw } = await sb.from('vehicles')
    .select('worker_id, model, year, plate, passenger_capacity')
    .in('worker_id', driverIds)
    .eq('is_active', true)
    .eq('status', 'approved');
  const vehicles = (vehiclesRaw ?? []) as VehicleRow[];

  const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const vehicleByWorker = new Map<
    string,
    { model: string | null; year: number | null; plate: string | null; passenger_capacity: number | null }
  >();
  for (const v of vehicles) {
    const wid = v.worker_id;
    if (vehicleByWorker.has(wid)) continue;
    vehicleByWorker.set(wid, {
      model: v.model?.trim() ? v.model : null,
      year: v.year != null ? Number(v.year) : null,
      plate: v.plate?.trim() ? v.plate : null,
      passenger_capacity: v.passenger_capacity != null ? Number(v.passenger_capacity) : null,
    });
  }

  const items: ClientScheduledTripItem[] = [];
  for (const t of trips) {
    const prof = profileMap.get(t.driver_id);
    const veh = vehicleByWorker.get(t.driver_id);
    const tripCap = t.capacity != null ? Number(t.capacity) : null;
    const vehCap = veh?.passenger_capacity ?? null;
    /** Coerência: oferta da viagem não pode exceder a capacidade do veículo. */
    if (vehCap != null && vehCap >= 1) {
      if (t.seats_available > vehCap) continue;
      if (tripCap != null && tripCap > vehCap) continue;
    }
    items.push({
      id: t.id,
      driver_id: t.driver_id,
      title: t.title ?? `${t.origin_address} → ${t.destination_address}`,
      driverName: (prof?.full_name as string) ?? 'Motorista',
      driverAvatarUrl: (prof?.avatar_url as string | null) ?? null,
      rating: Number(prof?.rating ?? 0),
      vehicle_model: veh?.model ?? null,
      vehicle_year: veh?.year ?? null,
      vehicle_plate: veh?.plate ?? null,
      vehicle_passenger_capacity: vehCap,
      badge: t.badge ?? 'Take Me',
      departure: formatTime(t.departure_at),
      arrival: formatTime(t.arrival_at),
      seats: t.seats_available,
      bags: t.bags_available,
      latitude: t.destination_lat,
      longitude: t.destination_lng,
      origin_lat: t.origin_lat,
      origin_lng: t.origin_lng,
      amount_cents: resolveTripPriceCents(
        {
          route_id: t.route_id,
          price_per_person_cents: t.price_per_person_cents,
          amount_cents: t.amount_cents,
        },
        routePriceById
      ),
      departure_at: t.departure_at,
    });
  }

  items.sort(compareTripsByDepartureAndBadge);
  return { items, error: null };
}
