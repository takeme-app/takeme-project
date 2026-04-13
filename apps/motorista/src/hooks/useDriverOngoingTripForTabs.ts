import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';

/**
 * Mesma regra do cartão de viagem ativa na Home: viagem com jornada iniciada,
 * status active, e não “pausada” no cronograma (rota com is_active = false).
 */
export function useDriverOngoingTripForTabs() {
  const [hasOngoingTrip, setHasOngoingTrip] = useState(false);

  const refresh = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setHasOngoingTrip(false);
      return;
    }
    const { data: tripData } = await supabase
      .from('scheduled_trips')
      .select('id, route_id, is_active')
      .eq('driver_id', user.id)
      .eq('status', 'active')
      .not('driver_journey_started_at', 'is', null)
      .order('departure_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!tripData) {
      setHasOngoingTrip(false);
      return;
    }
    const t = tripData as { route_id?: string | null; is_active?: boolean | null };
    if (t.route_id != null && t.is_active === false) {
      setHasOngoingTrip(false);
    } else {
      setHasOngoingTrip(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const teardownChannel = () => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };

    const subscribeForUser = async (userId: string) => {
      teardownChannel();
      channel = supabase
        .channel(`driver-ongoing-trip-tab-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'scheduled_trips',
            filter: `driver_id=eq.${userId}`,
          },
          () => {
            void refresh();
          },
        )
        .subscribe();
    };

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user?.id) {
        setHasOngoingTrip(false);
        return;
      }
      await refresh();
      if (cancelled) return;
      await subscribeForUser(user.id);
    })();

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        teardownChannel();
        if (!session?.user?.id) {
          setHasOngoingTrip(false);
          return;
        }
        await refresh();
        await subscribeForUser(session.user.id);
      })();
    });

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') void refresh();
    };
    const appSub = AppState.addEventListener('change', onAppState);

    return () => {
      cancelled = true;
      teardownChannel();
      authSubscription.unsubscribe();
      appSub.remove();
    };
  }, [refresh]);

  return { hasOngoingTrip, refresh };
}
