import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { latLngFromDbColumns, isValidGlobeCoordinate } from '../components/googleMaps';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StopType =
  | 'passenger_pickup'
  | 'passenger_dropoff'
  | 'package_pickup'
  | 'package_dropoff'
  | 'excursion_stop'
  | 'driver_origin'
  | 'trip_destination'
  | 'base_dropoff';

export type StopStatus = 'pending' | 'completed' | 'skipped';

export type TripStop = {
  id: string;
  scheduledTripId: string;
  stopType: StopType;
  entityId: string;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  sequenceOrder: number;
  status: StopStatus;
  notes: string | null;
  code: string | null;
};

// Colors per stop_type (PRD Admin §6.5)
export const STOP_TYPE_COLORS: Record<StopType, string> = {
  passenger_pickup: '#10B981',   // green  — embarque passageiro
  passenger_dropoff: '#3B82F6',  // blue   — desembarque passageiro
  package_pickup: '#F59E0B',     // amber  — coleta encomenda
  package_dropoff: '#6366F1',    // indigo — entrega encomenda
  excursion_stop: '#EC4899',     // pink   — parada excursão
  driver_origin: '#64748B',      // slate  — partida / ponto do motorista
  trip_destination: '#1D4ED8',   // blue   — destino final da viagem
  base_dropoff: '#EA580C',       // orange — entrega em base
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTripStops(tripId: string | null) {
  const [stops, setStops] = useState<TripStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Try trip_stops table
      const { data, error: fetchErr } = await supabase
        .from('trip_stops')
        .select('*')
        .eq('scheduled_trip_id', tripId)
        .order('sequence_order', { ascending: true });

      if (fetchErr) {
        // Table might not exist yet — fall back to manual join
        const fallback = await buildStopsManually(tripId);
        setStops(await finalizeStopsForTrip(tripId, fallback));
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        setStops(await finalizeStopsForTrip(tripId, mapRows(data)));
        setLoading(false);
        return;
      }

      // 2. No rows yet — try to generate via RPC (admin usa p_trip_id; alguns deploys usam trip_id)
      let rpcErr =
        (await supabase.rpc('generate_trip_stops' as never, { p_trip_id: tripId } as never)).error ??
        null;
      if (rpcErr) {
        const second = await supabase.rpc('generate_trip_stops' as never, { trip_id: tripId } as never);
        rpcErr = second.error ?? null;
      }

      if (!rpcErr) {
        // Refetch after generation
        const { data: generated } = await supabase
          .from('trip_stops')
          .select('*')
          .eq('scheduled_trip_id', tripId)
          .order('sequence_order', { ascending: true });

        if (generated && generated.length > 0) {
          setStops(await finalizeStopsForTrip(tripId, mapRows(generated)));
          setLoading(false);
          return;
        }
      }

      // 3. RPC not available or returned nothing — manual join fallback
      const fallback = await buildStopsManually(tripId);
      setStops(await finalizeStopsForTrip(tripId, fallback));
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar paradas');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  return { stops, loading, error, reload: load };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type StopRowMeta = { label?: string | null; sequence_order?: number | null };

/** Admin/PRD usam shipment_*; o app motorista usa package_* nos helpers de mapa. */
function normalizeDbStopType(db: string, row?: StopRowMeta): StopType {
  const raw = String(db ?? '').trim();
  const labelNorm = String(row?.label ?? '').trim().toLowerCase();
  const seq = row?.sequence_order;

  // Alguns deploys marcam o 1º ponto (partida do motorista) como shipment/package_pickup.
  if (
    (raw === 'shipment_pickup' || raw === 'package_pickup') &&
    (seq === 1 || seq === 0) &&
    (labelNorm === 'motorista' || labelNorm.includes('motorista'))
  ) {
    return 'driver_origin';
  }

  switch (raw) {
    case 'shipment_pickup':
      return 'package_pickup';
    case 'shipment_dropoff':
      return 'package_dropoff';
    case 'passenger_pickup':
    case 'passenger_dropoff':
    case 'package_pickup':
    case 'package_dropoff':
    case 'excursion_stop':
    case 'driver_origin':
    case 'trip_destination':
    case 'base_dropoff':
      return raw;
    default:
      return 'excursion_stop';
  }
}

function mapRows(rows: any[]): TripStop[] {
  return rows.map((r) => ({
    id: r.id,
    scheduledTripId: r.scheduled_trip_id,
    stopType: normalizeDbStopType(String(r.stop_type ?? ''), {
      label: r.label,
      sequence_order: r.sequence_order,
    }),
    entityId: r.entity_id,
    label: r.label ?? '',
    address: r.address ?? '',
    lat: r.lat ?? null,
    lng: r.lng ?? null,
    sequenceOrder: r.sequence_order,
    status: (r.status ?? 'pending') as StopStatus,
    notes: r.notes ?? null,
    code: r.code ?? null,
  }));
}

/** Ponto de “partida cadastrada” não entra na rota do app: o GPS já é o início da corrida. */
function omitDriverOriginStops(stops: TripStop[]): TripStop[] {
  return stops.filter((s) => s.stopType !== 'driver_origin');
}

type ShipmentRow = {
  id: string;
  instructions?: string | null;
  origin_address?: string | null;
  destination_address?: string | null;
  origin_lat?: unknown;
  origin_lng?: unknown;
  destination_lat?: unknown;
  destination_lng?: unknown;
  recipient_name?: string | null;
  pickup_code?: string | null;
  delivery_code?: string | null;
};

/** Paradas de coleta/entrega derivadas de `shipments` (motorista = driver da viagem). */
async function buildShipmentStopsOnly(tripId: string): Promise<TripStop[]> {
  const { data: tripDriverRow } = await supabase
    .from('scheduled_trips')
    .select('driver_id')
    .eq('id', tripId)
    .maybeSingle();
  const tripDriverId = (tripDriverRow as { driver_id?: string | null } | null)?.driver_id ?? null;
  if (!tripDriverId) return [];

  const { data: shipments } = await supabase
    .from('shipments')
    .select(`
      id,
      instructions,
      origin_address,
      destination_address,
      origin_lat,
      origin_lng,
      destination_lat,
      destination_lng,
      recipient_name,
      pickup_code,
      delivery_code
    `)
    .eq('scheduled_trip_id', tripId)
    .eq('driver_id', tripDriverId)
    .in('status', ['confirmed', 'in_progress']);

  const out: TripStop[] = [];
  for (const s of (shipments ?? []) as ShipmentRow[]) {
    const originShort = (s.origin_address ?? '').split(',')[0]?.trim() || 'Coleta';
    const pickupLL = latLngFromDbColumns(s.origin_lat, s.origin_lng);
    const dropLL = latLngFromDbColumns(s.destination_lat, s.destination_lng);
    out.push({
      id: `shipment-pickup-${s.id}`,
      scheduledTripId: tripId,
      stopType: 'package_pickup',
      entityId: s.id,
      label: originShort,
      address: s.origin_address ?? '',
      lat: pickupLL?.latitude ?? null,
      lng: pickupLL?.longitude ?? null,
      sequenceOrder: 0,
      status: 'pending',
      notes: s.instructions ?? null,
      code: s.pickup_code ?? null,
    });
    out.push({
      id: `shipment-dropoff-${s.id}`,
      scheduledTripId: tripId,
      stopType: 'package_dropoff',
      entityId: s.id,
      label: s.recipient_name?.trim() || 'Destinatário',
      address: s.destination_address ?? '',
      lat: dropLL?.latitude ?? null,
      lng: dropLL?.longitude ?? null,
      sequenceOrder: 0,
      status: 'pending',
      notes: null,
      code: s.delivery_code ?? null,
    });
  }
  return out;
}

function renumberStopSequence(stops: TripStop[]): TripStop[] {
  return stops.map((s, i) => ({ ...s, sequenceOrder: i + 1 }));
}

/** Mesmo shipment: `entity_id` no trip_stops ou id sintético `shipment-pickup|dropoff-{uuid}`. */
function normalizeShipmentEntityKey(stop: TripStop): string {
  const raw = String(stop.entityId ?? '').trim().toLowerCase();
  if (raw) return raw;
  const m = String(stop.id).match(/^shipment-(?:pickup|dropoff)-([0-9a-f-]{36})$/i);
  return (m?.[1] ?? '').toLowerCase();
}

function shipmentLegAlreadyInStops(
  stops: TripStop[],
  shipmentId: string,
  leg: 'package_pickup' | 'package_dropoff',
): boolean {
  const sid = shipmentId.trim().toLowerCase();
  return stops.some((x) => {
    if (x.stopType !== leg) return false;
    if (String(x.entityId ?? '').trim().toLowerCase() === sid) return true;
    const wantId = leg === 'package_pickup' ? `shipment-pickup-${shipmentId}` : `shipment-dropoff-${shipmentId}`;
    return x.id === wantId;
  });
}

/** Remove coleta/entrega duplicada do mesmo envio (merge + trip_stops com chaves diferentes). */
function dedupePackageStopsByShipment(stops: TripStop[]): TripStop[] {
  const seenPickup = new Set<string>();
  const seenDropoff = new Set<string>();
  const out: TripStop[] = [];
  for (const s of stops) {
    if (s.stopType !== 'package_pickup' && s.stopType !== 'package_dropoff') {
      out.push(s);
      continue;
    }
    const key = normalizeShipmentEntityKey(s);
    if (!key) {
      out.push(s);
      continue;
    }
    if (s.stopType === 'package_pickup') {
      if (seenPickup.has(key)) continue;
      seenPickup.add(key);
    } else {
      if (seenDropoff.has(key)) continue;
      seenDropoff.add(key);
    }
    out.push(s);
  }
  return out;
}

/**
 * `trip_stops` pode existir sem linhas de encomenda; o app ainda precisa exibir coleta/entrega do `shipments`.
 */
async function mergeMissingShipmentStopsIntoList(tripId: string, stops: TripStop[]): Promise<TripStop[]> {
  const manual = await buildShipmentStopsOnly(tripId);
  if (manual.length === 0) return stops;

  const byEntity = new Map<string, { pickup?: TripStop; dropoff?: TripStop }>();
  for (const s of manual) {
    const cur = byEntity.get(s.entityId) ?? {};
    if (s.stopType === 'package_pickup') cur.pickup = s;
    if (s.stopType === 'package_dropoff') cur.dropoff = s;
    byEntity.set(s.entityId, cur);
  }

  const additions: TripStop[] = [];
  for (const [entityId, pair] of byEntity) {
    const hasP = shipmentLegAlreadyInStops(stops, entityId, 'package_pickup');
    const hasD = shipmentLegAlreadyInStops(stops, entityId, 'package_dropoff');
    if (hasP && hasD) continue;
    if (!hasP && pair.pickup) additions.push(pair.pickup);
    if (!hasD && pair.dropoff) additions.push(pair.dropoff);
  }

  if (additions.length === 0) return stops;

  const destIdx = stops.findIndex((s) => s.stopType === 'trip_destination');
  const merged =
    destIdx === -1
      ? [...stops, ...additions]
      : [...stops.slice(0, destIdx), ...additions, ...stops.slice(destIdx)];

  return renumberStopSequence(merged);
}

/**
 * trip_stops do admin podem vir sem lat/lng; preenche coleta/entrega a partir de `shipments`
 * para o mapa traçar rota até origem e destino da encomenda.
 */
async function enrichPackageStopsFromShipments(tripId: string, stops: TripStop[]): Promise<TripStop[]> {
  const needs = stops.some(
    (s) =>
      (s.stopType === 'package_pickup' || s.stopType === 'package_dropoff') &&
      Boolean(s.entityId) &&
      (s.lat == null || s.lng == null || !isValidGlobeCoordinate(s.lat, s.lng)),
  );
  if (!needs) return stops;

  const { data: tripDriverRow } = await supabase
    .from('scheduled_trips')
    .select('driver_id')
    .eq('id', tripId)
    .maybeSingle();
  const tripDriverId = (tripDriverRow as { driver_id?: string | null } | null)?.driver_id ?? null;
  if (!tripDriverId) return stops;

  const { data: rows } = await supabase
    .from('shipments')
    .select('id, origin_lat, origin_lng, destination_lat, destination_lng')
    .eq('scheduled_trip_id', tripId)
    .eq('driver_id', tripDriverId)
    .in('status', ['confirmed', 'in_progress']);

  const byId = new Map<string, { origin_lat: unknown; origin_lng: unknown; destination_lat: unknown; destination_lng: unknown }>();
  for (const r of rows ?? []) {
    const row = r as { id?: string };
    if (row.id) byId.set(row.id, r as { origin_lat: unknown; origin_lng: unknown; destination_lat: unknown; destination_lng: unknown });
  }

  return stops.map((s) => {
    if (s.stopType !== 'package_pickup' && s.stopType !== 'package_dropoff') return s;
    if (s.lat != null && s.lng != null && isValidGlobeCoordinate(s.lat, s.lng)) return s;
    const row = byId.get(s.entityId);
    if (!row) return s;
    if (s.stopType === 'package_pickup') {
      const ll = latLngFromDbColumns(row.origin_lat, row.origin_lng);
      if (!ll) return s;
      return { ...s, lat: ll.latitude, lng: ll.longitude };
    }
    const ll = latLngFromDbColumns(row.destination_lat, row.destination_lng);
    if (!ll) return s;
    return { ...s, lat: ll.latitude, lng: ll.longitude };
  });
}

async function finalizeStopsForTrip(tripId: string, stops: TripStop[]): Promise<TripStop[]> {
  const merged = await mergeMissingShipmentStopsIntoList(tripId, stops);
  const withoutOrigin = omitDriverOriginStops(merged);
  const enriched = await enrichPackageStopsFromShipments(tripId, withoutOrigin);
  const deduped = dedupePackageStopsByShipment(enriched);
  return renumberStopSequence(deduped);
}

async function buildStopsManually(tripId: string): Promise<TripStop[]> {
  const result: TripStop[] = [];
  let seq = 1;

  // Bookings: origem/destino do passageiro vêm das colunas do booking (igual ao app cliente no checkout).
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id,
      passenger_count,
      notes,
      origin_address,
      origin_lat,
      origin_lng,
      destination_address,
      destination_lat,
      destination_lng,
      profiles ( full_name )
    `)
    .eq('scheduled_trip_id', tripId)
    .in('status', ['confirmed', 'in_progress']);

  type BookingRow = {
    id: string;
    notes?: string | null;
    origin_address?: string | null;
    origin_lat?: unknown;
    origin_lng?: unknown;
    destination_address?: string | null;
    destination_lat?: unknown;
    destination_lng?: unknown;
    profiles?: { full_name?: string | null } | null;
  };

  for (const b of (bookings ?? []) as BookingRow[]) {
    const name = b.profiles?.full_name?.trim() || 'Passageiro';
    const oAddr = b.origin_address?.trim() || 'Ponto de embarque';
    const dAddr = b.destination_address?.trim() || 'Ponto de desembarque';
    const oLL = latLngFromDbColumns(b.origin_lat, b.origin_lng);
    const dLL = latLngFromDbColumns(b.destination_lat, b.destination_lng);
    result.push({
      id: `booking-pickup-${b.id}`,
      scheduledTripId: tripId,
      stopType: 'passenger_pickup',
      entityId: b.id,
      label: name,
      address: oAddr,
      lat: oLL?.latitude ?? null,
      lng: oLL?.longitude ?? null,
      sequenceOrder: seq++,
      status: 'pending',
      notes: b.notes ?? null,
      code: null,
    });
    result.push({
      id: `booking-dropoff-${b.id}`,
      scheduledTripId: tripId,
      stopType: 'passenger_dropoff',
      entityId: b.id,
      label: name,
      address: dAddr,
      lat: dLL?.latitude ?? null,
      lng: dLL?.longitude ?? null,
      sequenceOrder: seq++,
      status: 'pending',
      notes: null,
      code: null,
    });
  }

  const shipmentStops = await buildShipmentStopsOnly(tripId);
  for (const s of shipmentStops) {
    result.push({ ...s, sequenceOrder: seq++ });
  }

  return result;
}
