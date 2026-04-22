import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

/**
 * Indica se há notificações não lidas (aba Perfil → mesmo indicador verde da Home).
 */
export function useUnreadNotifications(): boolean {
  const [hasUnread, setHasUnread] = useState(false);

  const fetchUnread = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      setHasUnread(false);
      return;
    }
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('target_app_slug', 'motorista')
      .is('read_at', null);
    if (error) {
      setHasUnread(false);
      return;
    }
    setHasUnread((count ?? 0) > 0);
  }, []);

  useEffect(() => {
    void fetchUnread();
  }, [fetchUnread]);

  useFocusEffect(
    useCallback(() => {
      void fetchUnread();
    }, [fetchUnread]),
  );

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user?.id) return;

      channel = supabase
        .channel(`unread_notif_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void fetchUnread();
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [fetchUnread]);

  return hasUnread;
}
