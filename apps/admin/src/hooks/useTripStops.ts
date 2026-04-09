import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { MapWaypoint } from '../components/MapView';

// ── Types ────────────────────────────────────────────────────────────
export interface TripStop {
  id: string;
  scheduled_trip_id: string;
  stop_type: string;
  entity_id: string | null;
  label: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  sequence_order: number;
  status: string;
}

interface UseTripStopsReturn {
  stops: TripStop[];
  /** Waypoints formatados para o MapView (sem origin/destination — esses vem do trip) */
  waypoints: MapWaypoint[];
  loading: boolean;
  /** Regenera stops (chamar após trocar motorista, add/remove passageiro, vincular encomenda) */
  regenerate: () => Promise<void>;
}

// ── Cores por tipo de parada (igual `STOP_TYPE_COLORS` no app motorista) ──
const STOP_COLORS: Record<string, string> = {
  passenger_pickup: '#10B981',
  passenger_dropoff: '#3B82F6',
  package_pickup: '#F59E0B',
  package_dropoff: '#6366F1',
  shipment_pickup: '#F59E0B',
  shipment_dropoff: '#6366F1',
  excursion_stop: '#EC4899',
  driver_origin: '#64748B',
  trip_destination: '#1D4ED8',
  base_dropoff: '#EA580C',
};

// ── Hook ─────────────────────────────────────────────────────────────
export function useTripStops(tripId: string | null | undefined): UseTripStopsReturn {
  const [stops, setStops] = useState<TripStop[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStops = useCallback(async () => {
    if (!tripId) { setStops([]); return; }
    setLoading(true);

    // 1. Buscar stops existentes
    const { data, error } = await (supabase as any)
      .from('trip_stops')
      .select('*')
      .eq('scheduled_trip_id', tripId)
      .order('sequence_order', { ascending: true });

    if (!error && data && data.length > 0) {
      setStops(data);
      setLoading(false);
      return;
    }

    // 2. Se não existem, gerar via function SQL
    await (supabase as any).rpc('generate_trip_stops', { p_trip_id: tripId });

    // 3. Buscar novamente
    const { data: generated } = await (supabase as any)
      .from('trip_stops')
      .select('*')
      .eq('scheduled_trip_id', tripId)
      .order('sequence_order', { ascending: true });

    setStops(generated || []);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    fetchStops();
  }, [fetchStops]);

  // Regenerar stops (ex: após trocar motorista)
  const regenerate = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    await (supabase as any).rpc('generate_trip_stops', { p_trip_id: tripId });
    const { data } = await (supabase as any)
      .from('trip_stops')
      .select('*')
      .eq('scheduled_trip_id', tripId)
      .order('sequence_order', { ascending: true });
    setStops(data || []);
    setLoading(false);
  }, [tripId]);

  // Converter stops intermediários em waypoints para MapView
  // (exclui driver_origin e trip_destination que viram origin/destination do MapView)
  // useMemo evita criar nova referência a cada render (o MapView depende da referência
  // para saber quando re-desenhar markers e buscar rota nova).
  const waypoints: MapWaypoint[] = useMemo(
    () =>
      stops
        .filter((s) => s.stop_type !== 'driver_origin' && s.stop_type !== 'trip_destination')
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => ({
          lat: s.lat!,
          lng: s.lng!,
          label: s.label || s.address,
          color: STOP_COLORS[s.stop_type] || '#767676',
          type: s.stop_type,
        })),
    [stops],
  );

  return { stops, waypoints, loading, regenerate };
}
