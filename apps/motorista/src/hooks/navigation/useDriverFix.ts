import { useCallback, useEffect, useRef, useState } from 'react';
import {
  haversineMeters,
  type DriverFix,
} from '../../lib/navigationCamera';
import type { LatLng } from '../../components/googleMaps/geometry';
import { isValidGlobeCoordinate } from '../../components/googleMaps/geometry';

let Location: any = null;
try { Location = require('expo-location'); } catch { /* not available yet */ }

const DRIVER_POSITION_UI_MIN_INTERVAL_MS = 90;
const DRIVER_POSITION_UI_MIN_MOVE_M = 4;
const ODOMETER_UI_FLUSH_MS = 650;
const ODOM_MAX_SEGMENT_M = 450;
/** Velocidade limite (m/s) abaixo da qual a bússola comanda o heading do ícone. */
const COMPASS_HEADING_MAX_SPEED_MPS = 1.5;

export type DriverFixHookResult = {
  /** Posição React-state com throttle (~90ms / 4m) — alimenta UI sem rerender por tick. */
  driverPosition: LatLng | null;
  /** Heading com throttle de 50ms / 2.5° — alimenta rotação do ícone fora de modo navegação. */
  driverHeadingDeg: number | null;
  /** Ref sempre atualizado a cada fix; útil para closures de GPS. */
  latestDriverFixRef: React.MutableRefObject<DriverFix | null>;
  /** Ref sincronizado para snapshot imediato (evita usar `driverPosition` defasado). */
  driverPositionRef: React.MutableRefObject<LatLng | null>;
  /** Ref de bússola (graus 0-360). Atualizado por `watchHeadingAsync`. */
  compassHeadingRef: React.MutableRefObject<number | null>;
  /** Odômetro acumulado em metros nesta sessão (descontado salto > 450m). */
  traveledMeters: number;
  /** Indica que o módulo expo-location não está disponível (precisa rebuild nativo). */
  locationModuleMissing: boolean;
  /** Indica que a permissão foi negada na última tentativa. */
  locationPermissionDenied: boolean;
};

export type DriverFixOptions = {
  /** Quando muda, zera o odômetro e o último flush (chave de "nova viagem"). */
  resetKey: string | null | undefined;
  /** Callback opcional chamado em cada fix válido (após dedup/snapping). */
  onFix?: (fix: DriverFix) => void;
  /** Liga/desliga a assinatura GPS (ex.: tela em background). Default true. */
  enabled?: boolean;
};

/**
 * Encapsula `expo-location` watch + heading + odômetro com throttle igual ao do
 * `ActiveTripScreen` original. Espelha 1:1 a lógica anterior — extração pura.
 *
 * Throttle UI:
 *   - posição: 90 ms ou 4 m, o que vier primeiro;
 *   - heading: 50 ms e ≥ 2.5° de delta angular.
 *
 * Em baixa velocidade (< 1.5 m/s) usa a bússola; em alta velocidade prefere o
 * GPS heading. Acima do throttle, qualquer valor "passa direto" para o ref.
 */
export function useDriverFix(options: DriverFixOptions): DriverFixHookResult {
  const { resetKey, onFix, enabled = true } = options;

  const [driverPosition, setDriverPosition] = useState<LatLng | null>(null);
  const [driverHeadingDeg, setDriverHeadingDeg] = useState<number | null>(null);
  const [traveledMeters, setTraveledMeters] = useState(0);
  const [locationModuleMissing, setLocationModuleMissing] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

  const driverPositionRef = useRef<LatLng | null>(null);
  const driverUiLastFlushRef = useRef<{ t: number; lat: number; lng: number } | null>(null);
  const driverHeadingLastFlushRef = useRef<{ t: number; deg: number | null }>({ t: 0, deg: null });
  const latestDriverFixRef = useRef<DriverFix | null>(null);
  const compassHeadingRef = useRef<number | null>(null);

  const odometerLastFixRef = useRef<{ lat: number; lng: number } | null>(null);
  const odometerPendingMRef = useRef(0);
  const odometerFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const locationSubRef = useRef<any>(null);
  const headingSubRef = useRef<{ remove: () => void } | null>(null);

  // O onFix callback troca a cada render — guardamos em ref para o effect
  // de assinatura GPS não reiniciar o watcher a cada novo handler.
  const onFixRef = useRef(onFix);
  useEffect(() => {
    onFixRef.current = onFix;
  }, [onFix]);

  const flushPositionToUi = useCallback((lat: number, lng: number) => {
    if (!isValidGlobeCoordinate(lat, lng)) return;
    const next: LatLng = { latitude: lat, longitude: lng };
    driverPositionRef.current = next;
    const last = driverUiLastFlushRef.current;
    const now = Date.now();
    if (!last) {
      driverUiLastFlushRef.current = { t: now, lat, lng };
      setDriverPosition(next);
      return;
    }
    const dt = now - last.t;
    const moved = haversineMeters(last.lat, last.lng, lat, lng);
    if (moved >= DRIVER_POSITION_UI_MIN_MOVE_M || dt >= DRIVER_POSITION_UI_MIN_INTERVAL_MS) {
      driverUiLastFlushRef.current = { t: now, lat, lng };
      setDriverPosition(next);
    }
  }, []);

  const flushHeadingToUi = useCallback((deg: number | null) => {
    const now = Date.now();
    const last = driverHeadingLastFlushRef.current;
    if (now - last.t < 50) return;
    const prev = last.deg;
    if (prev == null && deg == null) return;
    if (prev != null && deg != null) {
      const delta = Math.abs(((deg - prev + 540) % 360) - 180);
      if (delta < 2.5) return;
    }
    driverHeadingLastFlushRef.current = { t: now, deg };
    setDriverHeadingDeg(deg);
  }, []);

  const accumulateOdometer = useCallback((lat: number, lng: number) => {
    if (!isValidGlobeCoordinate(lat, lng)) return;
    const prev = odometerLastFixRef.current;
    odometerLastFixRef.current = { lat, lng };
    if (!prev) return;
    const d = haversineMeters(prev.lat, prev.lng, lat, lng);
    if (d < 2 || d > ODOM_MAX_SEGMENT_M) return;
    odometerPendingMRef.current += d;
    if (odometerFlushTimerRef.current != null) return;
    odometerFlushTimerRef.current = setTimeout(() => {
      odometerFlushTimerRef.current = null;
      const add = odometerPendingMRef.current;
      odometerPendingMRef.current = 0;
      if (add > 0) setTraveledMeters((m) => m + add);
    }, ODOMETER_UI_FLUSH_MS);
  }, []);

  // Reset por chave (nova viagem / nova encomenda).
  useEffect(() => {
    odometerLastFixRef.current = null;
    odometerPendingMRef.current = 0;
    if (odometerFlushTimerRef.current != null) {
      clearTimeout(odometerFlushTimerRef.current);
      odometerFlushTimerRef.current = null;
    }
    setTraveledMeters(0);
    driverUiLastFlushRef.current = null;
    driverPositionRef.current = null;
    setDriverPosition(null);
  }, [resetKey]);

  // GPS watch.
  useEffect(() => {
    if (!enabled) return;
    if (!Location) {
      setLocationModuleMissing(true);
      return;
    }
    let active = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationPermissionDenied(true);
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy?.High ?? Location.Accuracy.Balanced,
        });
        if (!active) return;
        const la = current.coords.latitude;
        const lo = current.coords.longitude;
        accumulateOdometer(la, lo);
        flushPositionToUi(la, lo);
        latestDriverFixRef.current = {
          latitude: la,
          longitude: lo,
          speedMps:
            typeof current.coords.speed === 'number' && current.coords.speed >= 0
              ? current.coords.speed
              : null,
          headingDeg:
            typeof current.coords.heading === 'number' && current.coords.heading >= 0
              ? current.coords.heading
              : null,
          timestamp: Date.now(),
        };
        onFixRef.current?.(latestDriverFixRef.current);

        locationSubRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy?.BestForNavigation ?? Location.Accuracy.High,
            distanceInterval: 1,
            timeInterval: 500,
          },
          (loc: any) => {
            if (!active) return;
            const lat = loc.coords.latitude;
            const lng = loc.coords.longitude;
            accumulateOdometer(lat, lng);
            flushPositionToUi(lat, lng);
            const speedMps =
              typeof loc.coords.speed === 'number' && loc.coords.speed >= 0
                ? loc.coords.speed
                : null;
            const headingDeg =
              typeof loc.coords.heading === 'number' && loc.coords.heading >= 0
                ? loc.coords.heading
                : null;
            const fix: DriverFix = {
              latitude: lat,
              longitude: lng,
              speedMps,
              headingDeg,
              timestamp: Date.now(),
            };
            latestDriverFixRef.current = fix;
            // Só usa heading do GPS se a velocidade for confiável.
            if (headingDeg != null && (speedMps ?? 0) >= COMPASS_HEADING_MAX_SPEED_MPS) {
              flushHeadingToUi(headingDeg);
            }
            onFixRef.current?.(fix);
          },
        );
      } catch {
        setLocationPermissionDenied(true);
      }
    })();

    return () => {
      active = false;
      try { locationSubRef.current?.remove?.(); } catch { /* noop */ }
      locationSubRef.current = null;
    };
  }, [enabled, flushPositionToUi, accumulateOdometer]);

  // Heading watch (bússola). Sempre ativo enquanto o hook está montado.
  useEffect(() => {
    if (!enabled) return;
    if (!Location?.watchHeadingAsync) return;
    let cancelled = false;

    (async () => {
      try {
        const sub = await Location.watchHeadingAsync((h: {
          trueHeading?: number;
          magHeading?: number;
        }) => {
          const th = h.trueHeading;
          const mh = h.magHeading;
          const v =
            typeof th === 'number' && th >= 0
              ? th
              : typeof mh === 'number' && mh >= 0
                ? mh
                : null;
          if (v != null) compassHeadingRef.current = v;
          const lastFix = latestDriverFixRef.current;
          const speed = lastFix?.speedMps ?? 0;
          if (v != null && speed < COMPASS_HEADING_MAX_SPEED_MPS) {
            flushHeadingToUi(v);
          }
        });
        if (!cancelled) headingSubRef.current = sub;
      } catch {
        /* hardware/permissão sem bússola — segue sem ela */
      }
    })();

    return () => {
      cancelled = true;
      try { headingSubRef.current?.remove?.(); } catch { /* noop */ }
      headingSubRef.current = null;
    };
  }, [enabled, flushHeadingToUi]);

  return {
    driverPosition,
    driverHeadingDeg,
    latestDriverFixRef,
    driverPositionRef,
    compassHeadingRef,
    traveledMeters,
    locationModuleMissing,
    locationPermissionDenied,
  };
}
