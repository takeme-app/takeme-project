/**
 * Helpers para câmera estilo Waze (heading-up): bearing, zoom/pitch por velocidade, padding.
 */

const EARTH_R_M = 6371000;
const SLOW_SPEED_KMH = 5;
const STOPPED_SPEED_KMH = 1.5;
const MIN_MOVE_M_FOR_COURSE = 2.5;
const BEARING_LERP = 0.16;
const ZOOM_LERP = 0.12;

/** Interpolação circular de azimute em graus (0–360). */
export function lerpAngleDegrees(from: number, to: number, t: number): number {
  let diff = ((to - from + 540) % 360) - 180;
  return (from + diff * t + 360) % 360;
}

/** Azimute inicial → final em graus (0 = norte). */
export function bearingBetweenLatLng(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const φ1 = (fromLat * Math.PI) / 180;
  const φ2 = (toLat * Math.PI) / 180;
  const Δλ = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = EARTH_R_M;
  const dφ = ((lat2 - lat1) * Math.PI) / 180;
  const dλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dφ / 2) * Math.sin(dφ / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dλ / 2) *
      Math.sin(dλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Desloca um ponto por `distanceM` metros no azimute `bearingDeg`. */
export function offsetLatLngByMeters(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceM: number,
): { latitude: number; longitude: number } {
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const angularDist = distanceM / EARTH_R_M;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDist) + Math.cos(lat1) * Math.sin(angularDist) * Math.cos(br),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(br) * Math.sin(angularDist) * Math.cos(lat1),
      Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { latitude: (lat2 * 180) / Math.PI, longitude: (lng2 * 180) / Math.PI };
}

export function zoomLevelForSpeedKmh(speedKmh: number): number {
  /** Mais “perto” que antes: parado/cidade ~19.5; autoestrada ainda legível (~17.8). */
  const minZ = 17.75;
  const maxZ = 19.5;
  if (!Number.isFinite(speedKmh) || speedKmh < 0) return maxZ;
  if (speedKmh < 4) return maxZ;
  if (speedKmh >= 90) return minZ;
  const t = (speedKmh - 4) / (90 - 4);
  return maxZ - t * (maxZ - minZ);
}

export function pitchDegreesForSpeedKmh(speedKmh: number): number {
  const minP = 45;
  const maxP = 58;
  if (!Number.isFinite(speedKmh) || speedKmh < 3) return minP;
  if (speedKmh >= 65) return maxP;
  return minP + ((speedKmh - 3) / (65 - 3)) * (maxP - minP);
}

export type NavigationEdgePadding = {
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
};

/** Padding assimétrico: mais área inferior → mais via à frente. `extraBottomOverlayPx` = UI sobre o mapa (card). */
export function buildNavigationPadding(params: {
  windowHeight: number;
  safeTop: number;
  safeBottom: number;
  /** UI flutuante no rodapé (ex. mini-sheet): soma ao padding inferior da câmera para o PIN não ficar atrás. */
  extraBottomOverlayPx?: number;
}): NavigationEdgePadding {
  const { windowHeight: h, safeTop, safeBottom } = params;
  const extra = params.extraBottomOverlayPx ?? 0;
  const topBar = safeTop + 52;
  const bottomReserve = Math.min(240, h * 0.24);
  return {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: topBar + h * 0.05,
    paddingBottom: bottomReserve + safeBottom + h * 0.1 + extra,
  };
}

export type DriverFix = {
  latitude: number;
  longitude: number;
  speedMps: number | null;
  headingDeg: number | null;
  timestamp: number;
};

export type NavigationBearingState = {
  smoothedBearing: number;
  smoothedZoom: number;
  prevLat: number | null;
  prevLng: number | null;
};

export function createInitialBearingState(initialBearing: number): NavigationBearingState {
  const z = zoomLevelForSpeedKmh(0);
  return {
    smoothedBearing: initialBearing,
    smoothedZoom: z,
    prevLat: null,
    prevLng: null,
  };
}

/**
 * Atualiza bearing suavizado e zoom suavizado a partir de um fix de GPS e opcionalmente bússola.
 */
export function computeNextNavigationCamera(params: {
  fix: DriverFix;
  compassHeadingDeg: number | null;
  state: NavigationBearingState;
  lookAheadMeters: number;
  bearingLerp?: number;
  zoomLerp?: number;
  /** Azimute do segmento da rota (após snap na polyline); alinha rotação com a linha laranja. */
  roadCourseDeg?: number | null;
}): {
  state: NavigationBearingState;
  center: { latitude: number; longitude: number };
  heading: number;
  pitch: number;
  zoomLevel: number;
} {
  const {
    fix,
    compassHeadingDeg,
    state,
    lookAheadMeters,
    bearingLerp = BEARING_LERP,
    zoomLerp = ZOOM_LERP,
    roadCourseDeg = null,
  } = params;

  const speedMps = fix.speedMps != null && fix.speedMps >= 0 ? fix.speedMps : 0;
  const speedKmh = speedMps * 3.6;

  let courseDeg: number | null = null;
  if (state.prevLat != null && state.prevLng != null) {
    const moved = haversineMeters(state.prevLat, state.prevLng, fix.latitude, fix.longitude);
    if (moved >= MIN_MOVE_M_FOR_COURSE) {
      courseDeg = bearingBetweenLatLng(
        state.prevLat,
        state.prevLng,
        fix.latitude,
        fix.longitude,
      );
    }
  }

  const gpsHeadingOk = fix.headingDeg != null && fix.headingDeg >= 0 && fix.headingDeg <= 360;
  const compassOk = compassHeadingDeg != null && Number.isFinite(compassHeadingDeg);

  let rawBearing = state.smoothedBearing;
  if (speedKmh < STOPPED_SPEED_KMH) {
    rawBearing = state.smoothedBearing;
  } else if (speedKmh < SLOW_SPEED_KMH) {
    if (roadCourseDeg != null && speedKmh >= 2.5) {
      rawBearing = roadCourseDeg;
    } else if (compassOk) rawBearing = compassHeadingDeg!;
    else if (courseDeg != null) rawBearing = courseDeg;
    else if (gpsHeadingOk) rawBearing = fix.headingDeg!;
  } else {
    if (roadCourseDeg != null && speedKmh >= 6) {
      rawBearing = roadCourseDeg;
    } else if (courseDeg != null) rawBearing = courseDeg;
    else if (gpsHeadingOk) rawBearing = fix.headingDeg!;
    else if (compassOk) rawBearing = compassHeadingDeg!;
  }

  const smoothedBearing = lerpAngleDegrees(state.smoothedBearing, rawBearing, bearingLerp);
  const targetZoom = zoomLevelForSpeedKmh(speedKmh);
  const smoothedZoom = state.smoothedZoom + (targetZoom - state.smoothedZoom) * zoomLerp;
  const pitch = pitchDegreesForSpeedKmh(speedKmh);

  const center = offsetLatLngByMeters(
    fix.latitude,
    fix.longitude,
    smoothedBearing,
    lookAheadMeters,
  );

  const nextState: NavigationBearingState = {
    smoothedBearing,
    smoothedZoom,
    prevLat: fix.latitude,
    prevLng: fix.longitude,
  };

  return {
    state: nextState,
    center,
    heading: smoothedBearing,
    pitch,
    zoomLevel: smoothedZoom,
  };
}
