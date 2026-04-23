import { useEffect, useRef } from 'react';
import {
  startDriverEtaSticky,
  type DriverEtaStickyOptions,
  type DriverEtaStickyState,
} from './driverEtaStickyNotification';

type UseDriverEtaStickyParams = {
  enabled: boolean;
  bookingId: string | null | undefined;
  etaSeconds: number | null;
  deeplink?: DriverEtaStickyOptions['deeplink'];
};

/**
 * Mantém a notificação sticky "Motorista está a X minutos" viva no Android
 * enquanto `enabled` for true e o bookingId estiver disponível. Atualiza o
 * conteúdo sempre que `etaSeconds` muda o bucket de minutos (throttle interno
 * evita flicker). Em iOS vira no-op.
 *
 * A criação e cancelamento são idempotentes: mudar o bookingId reinicia a
 * notificação com outro id.
 */
export function useDriverEtaSticky({
  enabled,
  bookingId,
  etaSeconds,
  deeplink,
}: UseDriverEtaStickyParams): void {
  const stickyRef = useRef<DriverEtaStickyState | null>(null);
  const activeBookingRef = useRef<string | null>(null);

  useEffect(() => {
    const id = bookingId ?? null;
    if (!enabled || !id) {
      if (stickyRef.current) {
        const prev = stickyRef.current;
        stickyRef.current = null;
        activeBookingRef.current = null;
        void prev.stop();
      }
      return;
    }

    if (activeBookingRef.current !== id) {
      const previous = stickyRef.current;
      stickyRef.current = startDriverEtaSticky({ bookingId: id, deeplink });
      activeBookingRef.current = id;
      if (previous) void previous.stop();
    }
  }, [enabled, bookingId, deeplink]);

  useEffect(() => {
    const sticky = stickyRef.current;
    if (!sticky) return;
    const minutes = etaSeconds != null && Number.isFinite(etaSeconds)
      ? Math.max(0, etaSeconds / 60)
      : null;
    void sticky.update({ etaMinutes: minutes });
  }, [etaSeconds]);

  useEffect(() => {
    return () => {
      const sticky = stickyRef.current;
      stickyRef.current = null;
      activeBookingRef.current = null;
      if (sticky) void sticky.stop();
    };
  }, []);
}
