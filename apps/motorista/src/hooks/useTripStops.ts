import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { latLngFromDbColumns } from '../components/googleMaps';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StopType =
  | 'passenger_pickup'
  | 'passenger_dropoff'
  | 'package_pickup'
  | 'package_dropoff'
  | 'excursion_stop';

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
        setStops(fallback);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        setStops(mapRows(data));
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
          setStops(mapRows(generated));
          setLoading(false);
          return;
        }
      }

      // 3. RPC not available or returned nothing — manual join fallback
      const fallback = await buildStopsManually(tripId);
      setStops(fallback);
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

/** Admin/PRD usam shipment_*; o app motorista usa package_* nos helpers de mapa. */
function normalizeDbStopType(db: string): StopType {
  switch (db) {
    case 'shipment_pickup':
      return 'package_pickup';
    case 'shipment_dropoff':
      return 'package_dropoff';
    case 'passenger_pickup':
    case 'passenger_dropoff':
    case 'package_pickup':
    case 'package_dropoff':
    case 'excursion_stop':
      return db;
    default:
      return 'excursion_stop';
  }
}

function mapRows(rows: any[]): TripStop[] {
  return rows.map((r) => ({
    id: r.id,
    scheduledTripId: r.scheduled_trip_id,
    stopType: normalizeDbStopType(String(r.stop_type ?? '')),
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

  // Shipments (package pickup + dropoff)
  const { data: shipments } = await supabase
    .from('shipments')
    .select(`
      id,
      description,
      notes,
      origin_address,
      destination_address,
      origin_lat,
      origin_lng,
      destination_lat,
      destination_lng,
      sender_name,
      receiver_name,
      pickup_code,
      delivery_code
    `)
    .eq('scheduled_trip_id', tripId)
    .in('status', ['confirmed', 'in_transit']);

  for (const s of shipments ?? []) {
    result.push({
      id: `shipment-pickup-${s.id}`,
      scheduledTripId: tripId,
      stopType: 'package_pickup',
      entityId: s.id,
      label: s.sender_name ?? 'Remetente',
      address: s.origin_address ?? '',
      lat: s.origin_lat ?? null,
      lng: s.origin_lng ?? null,
      sequenceOrder: seq++,
      status: 'pending',
      notes: s.notes ?? null,
      code: s.pickup_code ?? null,
    });
    result.push({
      id: `shipment-dropoff-${s.id}`,
      scheduledTripId: tripId,
      stopType: 'package_dropoff',
      entityId: s.id,
      label: s.receiver_name ?? 'Destinatário',
      address: s.destination_address ?? '',
      lat: s.destination_lat ?? null,
      lng: s.destination_lng ?? null,
      sequenceOrder: seq++,
      status: 'pending',
      notes: null,
      code: s.delivery_code ?? null,
    });
  }

  return result;
}
