import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type LiveDriverCoords = {
  latitude: number;
  longitude: number;
  updatedAt: string | null;
};

/**
 * Lê `scheduled_trip_live_locations` e mantém atualizado via Supabase Realtime.
 * O app motorista publica posição durante `scheduled_trips.status = active` (ActiveTripScreen).
 */
export function useScheduledTripLiveLocation(scheduledTripId: string | undefined | null): {
  coords: LiveDriverCoords | null;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const [coords, setCoords] = useState<LiveDriverCoords | null>(null);
  const [loading, setLoading] = useState(false);

  const applyRow = useCallback((row: { latitude: number; longitude: number; updated_at?: string | null } | null) => {
    if (
      !row ||
      typeof row.latitude !== 'number' ||
      typeof row.longitude !== 'number' ||
      !Number.isFinite(row.latitude) ||
      !Number.isFinite(row.longitude)
    ) {
      setCoords(null);
      return;
    }
    setCoords({
      latitude: row.latitude,
      longitude: row.longitude,
      updatedAt: row.updated_at ?? null,
    });
  }, []);

  const refetch = useCallback(async () => {
    if (!scheduledTripId) {
      setCoords(null);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('scheduled_trip_live_locations')
        .select('latitude, longitude, updated_at')
        .eq('scheduled_trip_id', scheduledTripId)
        .maybeSingle();
      if (error) {
        setCoords(null);
        return;
      }
      applyRow(data as { latitude: number; longitude: number; updated_at?: string | null } | null);
    } finally {
      setLoading(false);
    }
  }, [scheduledTripId, applyRow]);

  useEffect(() => {
    if (!scheduledTripId) {
      setCoords(null);
      return;
    }
    void refetch();

    const channel = supabase
      .channel(`slt-live-admin-${scheduledTripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_trip_live_locations',
          filter: `scheduled_trip_id=eq.${scheduledTripId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as {
            latitude?: number;
            longitude?: number;
            updated_at?: string | null;
          } | null;
          if (payload.eventType === 'DELETE' || !row) {
            setCoords(null);
            return;
          }
          applyRow({
            latitude: row.latitude as number,
            longitude: row.longitude as number,
            updated_at: row.updated_at ?? null,
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scheduledTripId, refetch, applyRow]);

  return { coords, loading, refetch };
}
