import { useEffect, useRef } from 'react';
import {
  ensureOfflinePackForRoute,
  type LatLngPoint,
  type EnsureOfflineResult,
} from '../lib/mapOffline';

type Options = {
  /** Identificador único e estável (ex.: `trip-<id>` / `shipment-<id>`). */
  packName: string | null | undefined;
  /** Polilinha da rota a cobrir; só dispara quando `coords.length >= 2`. */
  coords: LatLngPoint[] | null | undefined;
  /** Liga/desliga o auto-download (ex.: pode estar em rede medida). Default: true. */
  enabled?: boolean;
  /** Buffer em km ao redor da rota. Default 3 km. */
  bufferKm?: number;
  /** Callback opcional com o resultado do download (telemetria/UX). */
  onResult?: (result: EnsureOfflineResult) => void;
};

/**
 * Garante de forma idempotente que existe um pack offline para a rota atual.
 *
 * - Dispara `ensureOfflinePackForRoute` em background (fire-and-forget).
 * - Não tenta novamente para o mesmo `packName` na mesma sessão (cache local
 *   por `triedRef`). Se precisar forçar, mude o `packName`.
 * - Aceitar `coords = []` é seguro: nada é feito até a rota chegar.
 *
 * Importante: o download segue rodando mesmo se o componente desmontar — o
 * `offlineManager` do Mapbox cuida disso. Nada para limpar aqui.
 */
export function useRouteOfflinePack({
  packName,
  coords,
  enabled = true,
  bufferKm,
  onResult,
}: Options): void {
  const triedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !packName || !coords || coords.length < 2) return;
    if (triedRef.current === packName) return;
    triedRef.current = packName;

    let cancelled = false;
    void (async () => {
      const result = await ensureOfflinePackForRoute({
        packName,
        coords,
        bufferKm,
      });
      if (!cancelled) onResult?.(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [packName, coords, enabled, bufferKm, onResult]);
}
