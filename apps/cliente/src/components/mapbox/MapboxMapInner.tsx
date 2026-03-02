import React, { useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { MapView, Camera } from '@rnmapbox/maps';
import type { MapRegion } from './mapboxUtils';
import { toMapboxCoord, regionToZoomLevel } from './mapboxUtils';

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
  ref
) {
  const cameraRef = useRef<Camera>(null);
  const center = toMapboxCoord({
    latitude: initialRegion.latitude,
    longitude: initialRegion.longitude,
  });
  const zoomLevel = regionToZoomLevel(initialRegion);

  const animateToRegion = useCallback((region: MapRegion, duration = 400) => {
    cameraRef.current?.setCamera({
      centerCoordinate: [region.longitude, region.latitude],
      zoomLevel: regionToZoomLevel(region),
      animationDuration: duration,
    });
  }, []);

  useImperativeHandle(ref, () => ({ animateToRegion }), [animateToRegion]);

  return (
    <MapView style={style ?? { flex: 1 }} scrollEnabled={scrollEnabled}>
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
