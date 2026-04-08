import { useRef, type RefObject } from 'react';
import type { MapCameraStop } from './mapCameraTypes';
import { regionToZoomLevel } from './geometry';
import type { GoogleMapsMapRef } from './GoogleMapsMap';

export type LngLat = [number, number];

const DEFAULT_BOUNDS_PADDING = 1.45;

/** Une pontos base (usuário, destino, origem) com amostras da polyline sem duplicar. */
export function mergeLngLatPointsForCamera(basePoints: LngLat[], extraSamples: LngLat[]): LngLat[] {
  if (!extraSamples.length) return basePoints;
  const seen = new Set(basePoints.map((p) => `${p[0].toFixed(5)}_${p[1].toFixed(5)}`));
  const merged: LngLat[] = [...basePoints];
  for (const p of extraSamples) {
    const k = `${p[0].toFixed(5)}_${p[1].toFixed(5)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(p);
  }
  return merged;
}

function cameraStopFromLngLatBounds(
  pts: LngLat[],
  safeCenter: (p: LngLat) => LngLat,
  pad: number,
): MapCameraStop {
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const maxLng = Math.max(...lngs);
  const minLng = Math.min(...lngs);
  const maxLat = Math.max(...lats);
  const minLat = Math.min(...lats);
  const latSpan = Math.max(maxLat - minLat, 0.01);
  const lngSpan = Math.max(maxLng - minLng, 0.01);
  const zoom = regionToZoomLevel({
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latSpan * pad,
    longitudeDelta: lngSpan * pad,
  });
  const fitCoordinates = pts.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  return {
    type: 'CameraStop',
    centerCoordinate: safeCenter([(minLng + maxLng) / 2, (minLat + maxLat) / 2]),
    zoomLevel: zoom,
    animationDuration: 0,
    animationMode: 'none',
    fitCoordinates: pts.length >= 2 ? fitCoordinates : undefined,
  };
}

export type MapCameraFitInput = {
  fitPoints: LngLat[];
  hasRoutePolyline: boolean;
  userLngLat: LngLat | null;
  safeCenter: (p: LngLat) => LngLat;
  fallbackCenter: LngLat;
  singlePointZoom?: number;
  userZoom?: number;
  fallbackZoom?: number;
  boundsPadding?: number;
};

/**
 * Define um MapCameraStop para enquadrar vários pontos [lng,lat], priorizando rota + pontos, depois usuário.
 */
export function getMapCameraStopForLngLatFit(input: MapCameraFitInput): MapCameraStop {
  const {
    fitPoints: pts,
    hasRoutePolyline: hasRoute,
    userLngLat,
    safeCenter,
    fallbackCenter,
    singlePointZoom = 12,
    userZoom = 14,
    fallbackZoom = 11,
    boundsPadding = DEFAULT_BOUNDS_PADDING,
  } = input;

  if (hasRoute && pts.length >= 2) {
    return cameraStopFromLngLatBounds(pts, safeCenter, boundsPadding);
  }
  if (userLngLat) {
    return {
      type: 'CameraStop',
      centerCoordinate: safeCenter(userLngLat),
      zoomLevel: userZoom,
      animationDuration: 0,
      animationMode: 'none',
    };
  }
  if (pts.length >= 2) {
    return cameraStopFromLngLatBounds(pts, safeCenter, boundsPadding);
  }
  if (pts.length === 1) {
    return {
      type: 'CameraStop',
      centerCoordinate: safeCenter(pts[0]),
      zoomLevel: singlePointZoom,
      animationDuration: 0,
      animationMode: 'none',
    };
  }
  return {
    type: 'CameraStop',
    centerCoordinate: fallbackCenter,
    zoomLevel: fallbackZoom,
    animationDuration: 0,
    animationMode: 'none',
  };
}

/**
 * Ref com função estável para aplicar o enquadramento após load do mapa / idle / mudança de pontos.
 */
export function useMapCameraApply(
  mapRef: RefObject<GoogleMapsMapRef | null>,
  fitInput: MapCameraFitInput,
): RefObject<() => void> {
  const applyRef = useRef<() => void>(() => {});
  applyRef.current = () => {
    const setCam = mapRef.current?.setMapCamera;
    if (!setCam) return;
    setCam(getMapCameraStopForLngLatFit(fitInput));
  };
  return applyRef;
}
