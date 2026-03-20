import React, { useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../Text';
import type { MapRegion } from './mapboxUtils';
import { toMapboxCoord, regionToZoomLevel } from './mapboxUtils';

// Defensive require — falls back gracefully when native module not compiled yet.
let MapView: any = null;
let Camera: any = null;
let nativeAvailable = false;
try {
  const rnmapbox = require('@rnmapbox/maps');
  MapView = rnmapbox.MapView;
  Camera = rnmapbox.Camera;
  nativeAvailable = true;
} catch {
  // Native module not linked. Show fallback until app is rebuilt.
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

export type MapboxMapRef = {
  animateToRegion: (region: MapRegion, duration?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetCamera: () => void;
};

type MapboxMapProps = {
  style?: object;
  initialRegion: MapRegion;
  scrollEnabled?: boolean;
  children?: React.ReactNode;
};

export const MapboxMap = forwardRef<MapboxMapRef, MapboxMapProps>(function MapboxMap(
  { style, initialRegion, scrollEnabled = true, children },
  ref
) {
  if (!nativeAvailable || !MAPBOX_TOKEN.trim()) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackText}>Mapa indisponível</Text>
        <Text style={styles.fallbackSub}>
          {!nativeAvailable ? 'Rebuild necessário (expo run:android).' : 'Configure EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN.'}
        </Text>
      </View>
    );
  }

  const cameraRef = useRef<InstanceType<typeof Camera>>(null);
  const currentZoom = useRef(regionToZoomLevel(initialRegion));
  const center = toMapboxCoord({ latitude: initialRegion.latitude, longitude: initialRegion.longitude });
  const defaultZoom = regionToZoomLevel(initialRegion);

  const animateToRegion = useCallback((region: MapRegion, duration = 400) => {
    const z = regionToZoomLevel(region);
    currentZoom.current = z;
    cameraRef.current?.setCamera({ centerCoordinate: [region.longitude, region.latitude], zoomLevel: z, animationDuration: duration });
  }, []);

  const zoomIn = useCallback(() => {
    const next = Math.min(20, currentZoom.current + 1);
    currentZoom.current = next;
    cameraRef.current?.setCamera({ zoomLevel: next, animationDuration: 300 });
  }, []);

  const zoomOut = useCallback(() => {
    const next = Math.max(3, currentZoom.current - 1);
    currentZoom.current = next;
    cameraRef.current?.setCamera({ zoomLevel: next, animationDuration: 300 });
  }, []);

  const resetCamera = useCallback(() => {
    currentZoom.current = defaultZoom;
    cameraRef.current?.setCamera({ centerCoordinate: center, zoomLevel: defaultZoom, animationDuration: 400 });
  }, [center, defaultZoom]);

  useImperativeHandle(ref, () => ({ animateToRegion, zoomIn, zoomOut, resetCamera }), [animateToRegion, zoomIn, zoomOut, resetCamera]);

  return (
    <View style={[{ flex: 1 }, style]}>
      <MapView style={StyleSheet.absoluteFill} scrollEnabled={scrollEnabled} scaleBarEnabled={false}>
        <Camera ref={cameraRef} defaultSettings={{ centerCoordinate: center, zoomLevel: defaultZoom }} />
        {children}
      </MapView>
    </View>
  );
});

const styles = StyleSheet.create({
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E7EB' },
  fallbackText: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 4 },
  fallbackSub: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
});
