import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '../Text';
import { MaterialIcons } from '@expo/vector-icons';
import { MapView, Camera } from '@rnmapbox/maps';
import type { MapRegion } from './mapboxUtils';
import { toMapboxCoord, regionToZoomLevel, sanitizeMapRegion } from './mapboxUtils';

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
  showControls?: boolean;
  children?: React.ReactNode;
};

/**
 * Mapa Mapbox com API compatível com initialRegion/animateToRegion (react-native-maps).
 * Ref expõe animateToRegion(region, duration?), zoomIn(), zoomOut(), resetCamera().
 * Região inválida ou (0,0) → centro do Brasil; câmera re-sincroniza quando initialRegion muda.
 */
export const MapboxMap = forwardRef<MapboxMapRef, MapboxMapProps>(function MapboxMap(
  { style, initialRegion, scrollEnabled = true, showControls = false, children },
  ref,
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
  const currentZoom = useRef(10);

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

  const defaultZoom = useMemo(() => regionToZoomLevel(safeRegion), [safeRegion]);

  useEffect(() => {
    currentZoom.current = defaultZoom;
    cameraRef.current?.setCamera({
      centerCoordinate: center,
      zoomLevel: defaultZoom,
      animationDuration: 0,
    });
  }, [center, defaultZoom]);

  const animateToRegion = useCallback((region: MapRegion, duration = 400) => {
    const r = sanitizeMapRegion(region);
    const z = regionToZoomLevel(r);
    currentZoom.current = z;
    cameraRef.current?.setCamera({
      centerCoordinate: [r.longitude, r.latitude],
      zoomLevel: z,
      animationDuration: duration,
    });
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
    cameraRef.current?.setCamera({
      centerCoordinate: center,
      zoomLevel: defaultZoom,
      animationDuration: 400,
    });
  }, [center, defaultZoom]);

  useImperativeHandle(
    ref,
    () => ({ animateToRegion, zoomIn, zoomOut, resetCamera }),
    [animateToRegion, zoomIn, zoomOut, resetCamera],
  );

  return (
    <View style={[{ flex: 1 }, style]}>
      <MapView style={StyleSheet.absoluteFill} scrollEnabled={scrollEnabled} scaleBarEnabled={false}>
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: center,
            zoomLevel: defaultZoom,
          }}
        />
        {children}
      </MapView>

      {showControls && (
        <View style={styles.controls} pointerEvents="box-none">
          <TouchableOpacity style={styles.controlBtn} onPress={zoomIn} activeOpacity={0.7}>
            <MaterialIcons name="add" size={22} color="#0d0d0d" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={zoomOut} activeOpacity={0.7}>
            <MaterialIcons name="remove" size={22} color="#0d0d0d" />
          </TouchableOpacity>
          <View style={styles.controlSpacer} />
          <TouchableOpacity style={styles.controlBtn} onPress={resetCamera} activeOpacity={0.7}>
            <MaterialIcons name="my-location" size={20} color="#0d0d0d" />
          </TouchableOpacity>
        </View>
      )}
    </View>
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
  controls: {
    position: 'absolute',
    right: 10,
    top: 10,
    gap: 6,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  controlSpacer: {
    height: 4,
  },
});
