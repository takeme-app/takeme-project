import { useEffect, useRef, useState } from 'react';
import {
  getMultiPointRoute,
  getRouteWithDuration,
} from '../../lib/route';
import {
  getGoogleMapsApiKey,
  getMapboxAccessToken,
} from '../../lib/googleMapsConfig';
import {
  isValidGlobeCoordinate,
  type LatLng,
} from '../../components/googleMaps/geometry';

export type UseTripRouteOptions = {
  /** Habilita/desliga o efeito (ex.: enquanto a tela carrega dados). */
  enabled: boolean;
  /** Snapshot mais recente da posição do motorista (ref para evitar deps a cada tick GPS). */
  driverPositionRef: React.MutableRefObject<LatLng | null>;
  /** Estado React-state da posição (alimenta o efeito quando muda significativamente). */
  driverPosition: LatLng | null;
  /** Pontos restantes da rota (paradas → destino), já em ordem de visita. */
  remainingStopPoints: LatLng[];
  /** Destino "fallback" quando há apenas 0-1 paradas. */
  fallbackDestination: LatLng | null;
  /** Chave que força refetch (ex.: `rerouteKey` do `useRerouteController` + índice da parada). */
  refreshKey: string | number;
  /** Callback opcional ao concluir o fetch (sucesso ou vazio). */
  onCommit?: (coords: LatLng[]) => void;
};

export type UseTripRouteResult = {
  /** Polyline atual; vazia até o primeiro fetch terminar. */
  routeCoords: LatLng[];
  /** Ref espelhando `routeCoords` — útil para closures de GPS. */
  routeCoordsRef: React.MutableRefObject<LatLng[]>;
};

function dedupeConsecutivePoints(pts: LatLng[]): LatLng[] {
  const out: LatLng[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && last.latitude === p.latitude && last.longitude === p.longitude) continue;
    out.push(p);
  }
  return out;
}

/**
 * Encapsula o efeito de buscar a rota dourada (motorista → próximas paradas).
 * Tenta na ordem:
 *   1. `getMultiPointRoute([driver, ...stops])` — quando há ≥ 2 paradas restantes;
 *   2. `getRouteWithDuration(driver, stops[0])` — quando só 1 parada;
 *   3. `getRouteWithDuration(driver, fallbackDestination)` — última cartada.
 *
 * Cancela o fetch via `AbortController` ao desmontar / mudar de chave.
 */
export function useTripRoute({
  enabled,
  driverPositionRef,
  driverPosition,
  remainingStopPoints,
  fallbackDestination,
  refreshKey,
  onCommit,
}: UseTripRouteOptions): UseTripRouteResult {
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const routeCoordsRef = useRef<LatLng[]>([]);

  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  const stopsKey = remainingStopPoints
    .map((p) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`)
    .join('|');
  const driverKey = driverPosition
    ? `${driverPosition.latitude.toFixed(3)},${driverPosition.longitude.toFixed(3)}`
    : '';
  const fallbackKey = fallbackDestination
    ? `${fallbackDestination.latitude.toFixed(5)},${fallbackDestination.longitude.toFixed(5)}`
    : '';

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const controller = new AbortController();
    const routeOpts = {
      mapboxToken: getMapboxAccessToken(),
      googleMapsApiKey: getGoogleMapsApiKey(),
      signal: controller.signal,
    };

    const dpLive = driverPositionRef.current;
    const dp =
      dpLive && isValidGlobeCoordinate(dpLive.latitude, dpLive.longitude)
        ? dpLive
        : driverPosition;

    const commit = (coords: LatLng[]) => {
      routeCoordsRef.current = coords;
      setRouteCoords(coords);
      onCommitRef.current?.(coords);
    };

    (async () => {
      const stopPts = dedupeConsecutivePoints(remainingStopPoints);

      if (stopPts.length >= 2) {
        const withDriver =
          dp && isValidGlobeCoordinate(dp.latitude, dp.longitude)
            ? dedupeConsecutivePoints([dp, ...stopPts])
            : stopPts;
        const r = await getMultiPointRoute(withDriver, routeOpts);
        if (!cancelled && r?.coordinates?.length) {
          commit(r.coordinates);
          return;
        }
      }
      if (
        dp &&
        isValidGlobeCoordinate(dp.latitude, dp.longitude) &&
        stopPts.length === 1
      ) {
        const r = await getRouteWithDuration(dp, stopPts[0]!, routeOpts);
        if (!cancelled && r?.coordinates?.length) {
          commit(r.coordinates);
          return;
        }
      }
      if (
        dp &&
        isValidGlobeCoordinate(dp.latitude, dp.longitude) &&
        fallbackDestination
      ) {
        const r = await getRouteWithDuration(dp, fallbackDestination, routeOpts);
        if (!cancelled && r?.coordinates?.length) {
          commit(r.coordinates);
          return;
        }
      }
      if (!cancelled) commit([]);
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, driverKey, stopsKey, fallbackKey, refreshKey]);

  return { routeCoords, routeCoordsRef };
}
