import React, { useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../Text';
import { MapView, Camera } from '@rnmapbox/maps';
import type { MapRegion } from './mapboxUtils';
import { toMapboxCoord, regionToZoomLevel } from './mapboxUtils';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

export type MapboxMapRef = {
  animateToRegion: (region: MapRegion, duration?: number) => void;
};

type MapboxMapProps = {
  style?: object;
  initialRegion: MapRegion;
  scrollEnabled?: boolean;
  children?: React.ReactNode;
};

/**
 * Mapa Mapbox com API compatível com initialRegion/animateToRegion (react-native-maps).
 * Ref expõe animateToRegion(region, duration?).
 * Se EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN não estiver definido (ex.: no EAS), mostra fallback em vez de crashar.
 */
export const MapboxMap = forwardRef<MapboxMapRef, MapboxMapProps>(function MapboxMap(
  { style, initialRegion, scrollEnabled = true, children },
  ref
) {
  if (!MAPBOX_TOKEN.trim()) {
    return (
      <View style={[styles.fallback, style]} pointerEvents="none">
        <Text style={styles.fallbackText}>Mapa indisponível</Text>
        <Text style={styles.fallbackSubtext}>
          Configure EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN nas variáveis do projeto no EAS (ambiente Preview).
        </Text>
      </View>
    );
  }

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

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e5e5e5',
    padding: 24,
  },
  fallbackText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  fallbackSubtext: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
});
