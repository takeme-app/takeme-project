import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  computeNextNavigationCamera,
  createInitialBearingState,
  offsetLatLngByMeters,
  type DriverFix,
  type NavigationBearingState,
  type NavigationEdgePadding,
} from '../../lib/navigationCamera';
import { snapToRoutePolyline } from '../../lib/routeSnap';
import type { LatLng } from '../../components/googleMaps/geometry';
import { isValidGlobeCoordinate } from '../../components/googleMaps/geometry';
import type { GoogleMapsMapRef } from '../../components/googleMaps';

const NAV_ROUTE_SNAP_MAX_M = 68;
const NAV_LOOK_AHEAD_M = 70;
const TRIP_NAV_ZOOM_OFFSET = 1.8;
const DR_TICK_MS = 16;
const DR_CAMERA_ANIM_MS = 28;

type NavDRState = {
  anchorLat: number;
  anchorLng: number;
  heading: number;
  pitch: number;
  zoomLevel: number;
  padding: NavigationEdgePadding;
  fixedAt: number;
  speedMps: number;
  lookAheadM: number;
};

export type UseNavigationCameraOptions = {
  /** Ref do mapa (legacy `<GoogleMapsMap>`). Se ausente, hook é no-op. */
  mapRef: React.RefObject<GoogleMapsMapRef | null>;
  /** Habilita/desliga a câmera heading-up (modo "seguir GPS"). */
  followNav: boolean;
  /** Ref do último fix GPS (provido por `useDriverFix`). */
  latestDriverFixRef: React.MutableRefObject<DriverFix | null>;
  /** Ref de bússola (provido por `useDriverFix`). */
  compassHeadingRef: React.MutableRefObject<number | null>;
  /** Polyline de referência (rota dourada > linha imediata). Usada para snap + bearing da via. */
  routeForSnapRef: React.MutableRefObject<LatLng[]>;
  /** Padding inferior efetivo (px) — soma do safe-area + UI flutuante. */
  effectiveBottomInset: number;
  /** Padding superior — `safeAreaTop`. */
  insetTop: number;
};

export type UseNavigationCameraResult = {
  /** Chame após cada novo fix GPS (ou heading) para reagendar 1 frame. */
  scheduleNavFrame: () => void;
  /** Quando `followNav` desliga, chame para abortar o RAF + parar dead-reckoning. */
  stopAll: () => void;
};

/**
 * Encapsula a câmera "Waze-like" do motorista: bearing/zoom/pitch suavizados,
 * snap na polyline da rota, look-ahead à frente do veículo, e loop de
 * dead-reckoning a ~60fps que extrapola a posição entre fixes do GPS.
 *
 * Mantém o comportamento original do `ActiveTripScreen` 1:1.
 *
 * Importante: este hook depende do `mapRef` legado (`@rnmapbox/maps`). Quando
 * o app trocar para `<ExpoMapboxNavigationView>` (Fase 3), a câmera nativa do
 * Mapbox Navigation SDK substitui este hook por completo.
 */
export function useNavigationCamera({
  mapRef,
  followNav,
  latestDriverFixRef,
  compassHeadingRef,
  routeForSnapRef,
  effectiveBottomInset,
  insetTop,
}: UseNavigationCameraOptions): UseNavigationCameraResult {
  const followNavRef = useRef(followNav);
  const navBearingStateRef = useRef<NavigationBearingState | null>(null);
  const navRafRef = useRef<number | null>(null);
  const lastNavDRRef = useRef<NavDRState | null>(null);
  const drIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyHeadingUpCamera = useCallback(() => {
    if (!followNavRef.current) return;
    const raw = latestDriverFixRef.current;
    if (!raw || !isValidGlobeCoordinate(raw.latitude, raw.longitude)) return;
    if (!navBearingStateRef.current) {
      navBearingStateRef.current = createInitialBearingState(0);
    }
    const guide = routeForSnapRef.current;
    let fix: DriverFix = raw;
    let roadCourseDeg: number | null = null;
    if (guide.length >= 2) {
      const snap = snapToRoutePolyline(
        { latitude: raw.latitude, longitude: raw.longitude },
        guide,
        NAV_ROUTE_SNAP_MAX_M,
      );
      if (snap.distanceM <= NAV_ROUTE_SNAP_MAX_M) {
        fix = {
          ...raw,
          latitude: snap.snapped.latitude,
          longitude: snap.snapped.longitude,
        };
        roadCourseDeg = snap.segmentBearingDeg;
      }
    }
    const lookAheadM = guide.length >= 2 ? NAV_LOOK_AHEAD_M : 0;
    const padding: NavigationEdgePadding = {
      paddingTop: insetTop + 56,
      paddingBottom: effectiveBottomInset + 160,
      paddingLeft: 14,
      paddingRight: 14,
    };
    const out = computeNextNavigationCamera({
      fix,
      compassHeadingDeg: compassHeadingRef.current,
      state: navBearingStateRef.current,
      lookAheadMeters: lookAheadM,
      roadCourseDeg,
      bearingLerp: 0.25,
      zoomLerp: 0.20,
    });
    navBearingStateRef.current = out.state;
    lastNavDRRef.current = {
      anchorLat: fix.latitude,
      anchorLng: fix.longitude,
      heading: out.heading,
      pitch: out.pitch,
      zoomLevel: out.zoomLevel - TRIP_NAV_ZOOM_OFFSET,
      padding,
      fixedAt: Date.now(),
      speedMps: raw.speedMps != null && raw.speedMps > 0 ? raw.speedMps : 0,
      lookAheadM,
    };
  }, [insetTop, effectiveBottomInset, latestDriverFixRef, compassHeadingRef, routeForSnapRef]);

  const scheduleNavFrame = useCallback(() => {
    if (!followNavRef.current) return;
    if (navRafRef.current != null) return;
    navRafRef.current = requestAnimationFrame(() => {
      navRafRef.current = null;
      applyHeadingUpCamera();
    });
  }, [applyHeadingUpCamera]);

  const stopAll = useCallback(() => {
    if (navRafRef.current != null) {
      cancelAnimationFrame(navRafRef.current);
      navRafRef.current = null;
    }
    if (drIntervalRef.current != null) {
      clearInterval(drIntervalRef.current);
      drIntervalRef.current = null;
    }
  }, []);

  // Sincroniza o ref do follow + reseta bearing state ao reentrar.
  useLayoutEffect(() => {
    followNavRef.current = followNav;
    if (followNav) {
      navBearingStateRef.current = createInitialBearingState(0);
      requestAnimationFrame(() => scheduleNavFrame());
    } else {
      stopAll();
    }
  }, [followNav, scheduleNavFrame, stopAll]);

  // Cleanup global ao desmontar.
  useEffect(() => () => stopAll(), [stopAll]);

  // Loop de dead-reckoning (~60 fps).
  useEffect(() => {
    if (!followNav) {
      if (drIntervalRef.current != null) {
        clearInterval(drIntervalRef.current);
        drIntervalRef.current = null;
      }
      return;
    }
    drIntervalRef.current = setInterval(() => {
      if (!followNavRef.current) return;
      const nav = lastNavDRRef.current;
      if (!nav || !mapRef.current) return;
      const dtS = Math.min((Date.now() - nav.fixedAt) / 1000, 2.5);
      const extrapolated =
        nav.speedMps > 0.4
          ? offsetLatLngByMeters(nav.anchorLat, nav.anchorLng, nav.heading, nav.speedMps * dtS)
          : { latitude: nav.anchorLat, longitude: nav.anchorLng };
      const center =
        nav.lookAheadM > 0
          ? offsetLatLngByMeters(
              extrapolated.latitude,
              extrapolated.longitude,
              nav.heading,
              nav.lookAheadM,
            )
          : extrapolated;
      mapRef.current.setNavigationCamera({
        centerCoordinate: [center.longitude, center.latitude],
        heading: nav.heading,
        pitch: nav.pitch,
        zoomLevel: nav.zoomLevel,
        padding: nav.padding,
        animationDuration: DR_CAMERA_ANIM_MS,
      });
    }, DR_TICK_MS);
    return () => {
      if (drIntervalRef.current != null) {
        clearInterval(drIntervalRef.current);
        drIntervalRef.current = null;
      }
    };
  }, [followNav, mapRef]);

  return { scheduleNavFrame, stopAll };
}
