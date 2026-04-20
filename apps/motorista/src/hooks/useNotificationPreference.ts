import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

/**
 * Lê uma chave em `public.notification_preferences` para o usuário logado.
 *
 * - Retorna `defaultEnabled` enquanto carrega (evita "piscar" telas que
 *   escondem elementos quando a preferência está desligada).
 * - Recarrega ao montar, ao focar a tela (via React Navigation) e quando
 *   a linha correspondente muda no banco (Supabase Realtime). Isso é
 *   necessário porque telas de tab ficam montadas em background, então
 *   um `useEffect` simples só dispararia uma vez.
 * - Fonte única de verdade: mesma tabela usada pela tela "Configurar
 *   notificações" (`NotificationsScreen`).
 */
export function useNotificationPreference(
  key: string,
  defaultEnabled = true,
): boolean {
  const [enabled, setEnabled] = useState<boolean>(defaultEnabled);
  const userIdRef = useRef<string | null>(null);

  const fetchPref = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;
    userIdRef.current = user.id;

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('enabled')
      .eq('user_id', user.id)
      .eq('key', key)
      .maybeSingle();

    if (error || !data) {
      setEnabled(defaultEnabled);
      return;
    }
    setEnabled(Boolean((data as { enabled: boolean }).enabled));
  }, [key, defaultEnabled]);

  useEffect(() => {
    void fetchPref();
  }, [fetchPref]);

  useFocusEffect(
    useCallback(() => {
      void fetchPref();
    }, [fetchPref]),
  );

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user?.id) return;

      channel = supabase
        .channel(`notif_pref_${user.id}_${key}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notification_preferences',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const row = (payload.new ?? payload.old) as
              | { key?: string; enabled?: boolean }
              | null;
            if (!row || row.key !== key) return;
            if (payload.eventType === 'DELETE') {
              setEnabled(defaultEnabled);
              return;
            }
            if (typeof row.enabled === 'boolean') {
              setEnabled(row.enabled);
            }
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [key, defaultEnabled]);

  return enabled;
}
