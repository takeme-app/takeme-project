import { useCallback, useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';
import { snapToRoutePolyline } from '../../lib/routeSnap';
import type { LatLng } from '../../components/googleMaps/geometry';
import type { DriverFix } from '../../lib/navigationCamera';

const REROUTE_TRIGGER_M = 55;
const REROUTE_COOLDOWN_MS = 10_000;
const REROUTE_MIN_CONSECUTIVE_FIXES = 2;
const REROUTE_MIN_SPEED_MPS = 1;
const REROUTE_FAST_BEARING_DELTA_DEG = 90;
const REROUTE_FAST_MIN_SPEED_MPS = 3;
const REROUTE_FAST_DISTANCE_FACTOR = 0.5;
const REROUTE_ADAPTIVE_WINDOW_MS = 60_000;
const REROUTE_ADAPTIVE_COOLDOWN_MS = 30_000;
const REROUTE_ADAPTIVE_THRESHOLD = 2;
const REROUTE_NETWORK_FAIL_AFTER_MS = 15_000;
const REROUTE_HAPTIC_MS = 40;

const WRONG_DIRECTION_DELTA_DEG = 100;
const WRONG_DIRECTION_ENTER_MS = 1_500;
const WRONG_DIRECTION_LEAVE_MS = 1_500;
const WRONG_DIRECTION_MIN_SPEED_MPS = 2;

export type RerouteControllerOptions = {
  /** Polyline atual da rota — usada para detecção off-route. Linhas retas (2 pontos) devem ser excluídas. */
  offRouteGuideRef: React.MutableRefObject<LatLng[]>;
  /** Disparado quando o trigger consolida (após cooldown + fixes consecutivos). */
  onTriggerReroute: () => void;
};

export type RerouteControllerResult = {
  /** Avalie a cada novo fix GPS. Trata badges, cooldowns e dispara `onTriggerReroute`. */
  evaluateFix: (fix: DriverFix) => void;
  /** Reseta os badges quando a rota é trocada por motivo externo (ex.: nova parada). */
  resetBadges: () => void;
  /** Marca que um reroute foi iniciado (controla o badge "Recalculando" visível). */
  markRerouteStarted: () => void;
  /** Marca que o reroute terminou (chega da Directions API). */
  markRerouteFinished: () => void;
  /** `true` enquanto o motorista parece estar fora da rota (visual imediato). */
  isOffRouteSoft: boolean;
  /** `true` quando o heading do motorista difere > 100° do segmento da rota com velocidade. */
  isWrongDirection: boolean;
  /** `true` quando o reroute em curso passou do timeout sem retorno (sem rede / falha). */
  rerouteNetworkError: boolean;
  /** Chave incremental que aciona refetch de rota dourada / dashed. Inclua nas deps dos effects de fetch. */
  rerouteKey: number;
  /** `true` enquanto o app aguarda a nova polyline. */
  isRerouting: boolean;
};

/**
 * Heurísticas off-route do `ActiveTripScreen` extraídas em hook reutilizável:
 *  - 2 fixes consecutivos > 55m da rota → reroute (após cooldown 10s);
 *  - desvio rápido por curva errada (> 90° + speed > 3 m/s + > 27.5m da rota) → reroute imediato;
 *  - cooldown adaptativo: ≥ 2 reroutes em 60s eleva cooldown para 30s;
 *  - badge "direção errada" com janelas anti-flicker de 1.5s entrar/sair;
 *  - badge de rede vermelho após 15s sem resposta da Directions.
 */
export function useRerouteController({
  offRouteGuideRef,
  onTriggerReroute,
}: RerouteControllerOptions): RerouteControllerResult {
  const [isOffRouteSoft, setIsOffRouteSoft] = useState(false);
  const [isWrongDirection, setIsWrongDirection] = useState(false);
  const [rerouteNetworkError, setRerouteNetworkError] = useState(false);
  const [rerouteKey, setRerouteKey] = useState(0);
  const [isRerouting, setIsRerouting] = useState(false);

  const isOffRouteSoftRef = useRef(false);
  const isWrongDirectionRef = useRef(false);
  const wrongDirectionEnterAtRef = useRef<number | null>(null);
  const wrongDirectionLeaveAtRef = useRef<number | null>(null);

  const rerouteOffCountRef = useRef(0);
  const rerouteLastAtRef = useRef(0);
  const rerouteHistoryRef = useRef<number[]>([]);
  const rerouteNetworkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTriggerRef = useRef(onTriggerReroute);
  useEffect(() => {
    onTriggerRef.current = onTriggerReroute;
  }, [onTriggerReroute]);

  const getEffectiveCooldownMs = useCallback(() => {
    const now = Date.now();
    const recent = rerouteHistoryRef.current.filter(
      (t) => now - t <= REROUTE_ADAPTIVE_WINDOW_MS,
    );
    return recent.length >= REROUTE_ADAPTIVE_THRESHOLD
      ? REROUTE_ADAPTIVE_COOLDOWN_MS
      : REROUTE_COOLDOWN_MS;
  }, []);

  const triggerReroute = useCallback(() => {
    const now = Date.now();
    const history = rerouteHistoryRef.current;
    while (history.length > 0 && now - history[0] > REROUTE_ADAPTIVE_WINDOW_MS) {
      history.shift();
    }
    history.push(now);
    rerouteLastAtRef.current = now;
    if (rerouteNetworkTimerRef.current) clearTimeout(rerouteNetworkTimerRef.current);
    rerouteNetworkTimerRef.current = setTimeout(() => {
      setRerouteNetworkError(true);
    }, REROUTE_NETWORK_FAIL_AFTER_MS);
    setRerouteNetworkError(false);
    setIsRerouting(true);
    setRerouteKey((k) => k + 1);
    onTriggerRef.current?.();
  }, []);

  const markRerouteStarted = useCallback(() => {
    rerouteLastAtRef.current = Date.now();
    setIsRerouting(true);
  }, []);

  const markRerouteFinished = useCallback(() => {
    if (rerouteNetworkTimerRef.current) {
      clearTimeout(rerouteNetworkTimerRef.current);
      rerouteNetworkTimerRef.current = null;
    }
    setIsRerouting(false);
    setRerouteNetworkError(false);
  }, []);

  const resetBadges = useCallback(() => {
    isOffRouteSoftRef.current = false;
    isWrongDirectionRef.current = false;
    wrongDirectionEnterAtRef.current = null;
    wrongDirectionLeaveAtRef.current = null;
    setIsOffRouteSoft(false);
    setIsWrongDirection(false);
  }, []);

  const evaluateFix = useCallback(
    (fix: DriverFix) => {
      const speedMps = fix.speedMps ?? 0;
      const headingDeg = fix.headingDeg;
      const activeRoute = offRouteGuideRef.current;
      if (activeRoute.length < 2) {
        if (isOffRouteSoftRef.current) {
          isOffRouteSoftRef.current = false;
          setIsOffRouteSoft(false);
        }
        if (isWrongDirectionRef.current) {
          isWrongDirectionRef.current = false;
          wrongDirectionEnterAtRef.current = null;
          wrongDirectionLeaveAtRef.current = null;
          setIsWrongDirection(false);
        }
        return;
      }

      const snap = snapToRoutePolyline(
        { latitude: fix.latitude, longitude: fix.longitude },
        activeRoute,
        REROUTE_TRIGGER_M,
      );
      const farAway = snap.distanceM > REROUTE_TRIGGER_M;
      const halfDistance = snap.distanceM > REROUTE_TRIGGER_M * REROUTE_FAST_DISTANCE_FACTOR;

      let bearingDiffDeg: number | null = null;
      let fastBearingTrigger = false;
      if (headingDeg != null) {
        bearingDiffDeg = Math.abs(((headingDeg - snap.segmentBearingDeg + 540) % 360) - 180);
      }
      if (
        halfDistance &&
        bearingDiffDeg != null &&
        speedMps >= REROUTE_FAST_MIN_SPEED_MPS
      ) {
        fastBearingTrigger = bearingDiffDeg > REROUTE_FAST_BEARING_DELTA_DEG;
      }

      const isOffSoft = farAway || fastBearingTrigger;
      const wrongCandidate =
        bearingDiffDeg != null &&
        bearingDiffDeg > WRONG_DIRECTION_DELTA_DEG &&
        speedMps >= WRONG_DIRECTION_MIN_SPEED_MPS;

      const nowTs = Date.now();
      if (wrongCandidate) {
        wrongDirectionLeaveAtRef.current = null;
        if (wrongDirectionEnterAtRef.current == null) {
          wrongDirectionEnterAtRef.current = nowTs;
        } else if (
          !isWrongDirectionRef.current &&
          nowTs - wrongDirectionEnterAtRef.current >= WRONG_DIRECTION_ENTER_MS
        ) {
          isWrongDirectionRef.current = true;
          setIsWrongDirection(true);
        }
      } else {
        wrongDirectionEnterAtRef.current = null;
        if (isWrongDirectionRef.current) {
          if (wrongDirectionLeaveAtRef.current == null) {
            wrongDirectionLeaveAtRef.current = nowTs;
          } else if (
            nowTs - wrongDirectionLeaveAtRef.current >= WRONG_DIRECTION_LEAVE_MS
          ) {
            isWrongDirectionRef.current = false;
            wrongDirectionLeaveAtRef.current = null;
            setIsWrongDirection(false);
          }
        }
      }

      if (isOffSoft !== isOffRouteSoftRef.current) {
        isOffRouteSoftRef.current = isOffSoft;
        setIsOffRouteSoft(isOffSoft);
        if (isOffSoft) {
          try {
            Vibration.vibrate(REROUTE_HAPTIC_MS);
          } catch {
            /* alguns devices/emuladores não vibram */
          }
        }
      }

      const canTrigger = speedMps >= REROUTE_MIN_SPEED_MPS || fastBearingTrigger;
      if (isOffSoft && canTrigger) {
        rerouteOffCountRef.current += 1;
        const needed = fastBearingTrigger ? 1 : REROUTE_MIN_CONSECUTIVE_FIXES;
        const cooldown = getEffectiveCooldownMs();
        if (
          rerouteOffCountRef.current >= needed &&
          Date.now() - rerouteLastAtRef.current > cooldown
        ) {
          rerouteOffCountRef.current = 0;
          triggerReroute();
        }
      } else if (!isOffSoft) {
        rerouteOffCountRef.current = 0;
      }
    },
    [offRouteGuideRef, getEffectiveCooldownMs, triggerReroute],
  );

  // Cleanup do timer de rede ao desmontar.
  useEffect(
    () => () => {
      if (rerouteNetworkTimerRef.current) {
        clearTimeout(rerouteNetworkTimerRef.current);
        rerouteNetworkTimerRef.current = null;
      }
    },
    [],
  );

  return {
    evaluateFix,
    resetBadges,
    markRerouteStarted,
    markRerouteFinished,
    isOffRouteSoft,
    isWrongDirection,
    rerouteNetworkError,
    rerouteKey,
    isRerouting,
  };
}
