import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import { MapView, Camera } from '@rnmapbox/maps';
import { MAPBOX_NATIVE_MAP_STYLE_URL } from '@take-me/shared';
import type { MapRegion } from './mapboxUtils';
import { toMapboxCoord, regionToZoomLevel, sanitizeMapRegion } from './mapboxUtils';

export type MapboxMapRef = {
  animateToRegion: (region: MapRegion, duration?: number) => void;
};

type MapboxMapInnerProps = {
  style?: object;
  initialRegion: MapRegion;
  scrollEnabled?: boolean;
  children?: React.ReactNode;
};

/**
 * Implementação do mapa Mapbox (só carregada quando há token, para evitar crash).
 */
const MapboxMapInner = forwardRef<MapboxMapRef, MapboxMapInnerProps>(function MapboxMapInner(
  { style, initialRegion, scrollEnabled = true, children },
  ref,
) {
  const cameraRef = useRef<Camera>(null);

  const safeRegion = useMemo(
    () => sanitizeMapRegion(initialRegion),
    [
      initialRegion.latitude,
      initialRegion.longitude,
      initialRegion.latitudeDelta,
      initialRegion.longitudeDelta,
    ],
  );

  const center = useMemo(
    () =>
      toMapboxCoord({
        latitude: safeRegion.latitude,
        longitude: safeRegion.longitude,
      }),
    [safeRegion.latitude, safeRegion.longitude],
  );

  const zoomLevel = useMemo(() => regionToZoomLevel(safeRegion), [safeRegion]);

  useEffect(() => {
    cameraRef.current?.setCamera({
      centerCoordinate: center,
      zoomLevel,
      animationDuration: 0,
    });
  }, [center, zoomLevel]);

  const animateToRegion = useCallback((region: MapRegion, duration = 400) => {
    const r = sanitizeMapRegion(region);
    cameraRef.current?.setCamera({
      centerCoordinate: [r.longitude, r.latitude],
      zoomLevel: regionToZoomLevel(r),
      animationDuration: duration,
    });
  }, []);

  useImperativeHandle(ref, () => ({ animateToRegion }), [animateToRegion]);

  return (
    <MapView
      style={style ?? { flex: 1 }}
      styleURL={MAPBOX_NATIVE_MAP_STYLE_URL}
      scrollEnabled={scrollEnabled}
      scaleBarEnabled={false}
    >
      <Camera
        ref={cameraRef}
        defaultSettings={{
          centerCoordinate: center,
          zoomLevel,
        }}
      />
      {children}
    </MapView>
  );
});

export default MapboxMapInner;
