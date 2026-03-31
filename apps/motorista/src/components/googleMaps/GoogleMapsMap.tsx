import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { MapView, Camera, UserLocation } from '@rnmapbox/maps';
import type { Camera as MapboxCamera } from '@rnmapbox/maps';
import { Text } from '../Text';
import type { MapCameraSetConfig, MapCameraStop } from './mapCameraTypes';
import type { MapRegion } from './geometry';
import { regionToZoomLevel, sanitizeMapRegion } from './geometry';
import { getMapboxAccessToken } from '../../lib/googleMapsConfig';

function applyCameraStop(camera: MapboxCamera | null, config: MapCameraStop): void {
  if (!camera) return;
  const fc = config.fitCoordinates;
  if (fc && fc.length >= 2) {
    const lngs = fc.map((c) => c.longitude);
    const lats = fc.map((c) => c.latitude);
    camera.setCamera({
      bounds: {
        ne: [Math.max(...lngs), Math.max(...lats)],
        sw: [Math.min(...lngs), Math.min(...lats)],
      },
      padding: { paddingTop: 56, paddingRight: 56, paddingBottom: 56, paddingLeft: 56 },
      animationDuration: config.animationDuration ?? 400,
    });
    return;
  }
  const [lng, lat] = config.centerCoordinate;
  camera.setCamera({
    centerCoordinate: [lng, lat],
    zoomLevel: config.zoomLevel,
    animationDuration: config.animationDuration ?? 0,
  });
}

export type GoogleMapsMapRef = {
  animateToRegion: (region: MapRegion, duration?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetCamera: () => void;
  setMapCamera: (config: MapCameraSetConfig) => void;
};

type GoogleMapsMapProps = {
  style?: object;
  initialRegion: MapRegion;
  scrollEnabled?: boolean;
  styleURL?: string;
  children?: React.ReactNode;
  onDidFinishLoadingMap?: () => void;
  onDidFinishLoadingStyle?: () => void;
  onMapIdle?: () => void;
  logoEnabled?: boolean;
  attributionEnabled?: boolean;
  compassEnabled?: boolean;
  showsUserLocation?: boolean;
  centerOnUserAtStart?: boolean;
};

export const GoogleMapsMap = forwardRef<GoogleMapsMapRef, GoogleMapsMapProps>(function GoogleMapsMap(
  {
    style,
    initialRegion,
    scrollEnabled = true,
    children,
    onDidFinishLoadingMap,
    onDidFinishLoadingStyle,
    onMapIdle,
    showsUserLocation = false,
  },
  ref,
) {
  /** Env estático + `extra` do manifest (EAS / dev client) — ver `googleMapsConfig`. */
  const token = getMapboxAccessToken();

  const cameraRef = useRef<MapboxCamera>(null);
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
      [safeRegion.longitude, safeRegion.latitude] as [number, number],
    [safeRegion.latitude, safeRegion.longitude],
  );

  const zoomLevel = useMemo(() => regionToZoomLevel(safeRegion), [safeRegion]);

  useEffect(() => {
    currentZoom.current = zoomLevel;
    cameraRef.current?.setCamera({
      centerCoordinate: center,
      zoomLevel,
      animationDuration: 0,
    });
  }, [center, zoomLevel]);

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
    currentZoom.current = zoomLevel;
    cameraRef.current?.setCamera({
      centerCoordinate: center,
      zoomLevel,
      animationDuration: 400,
    });
  }, [center, zoomLevel]);

  const setMapCamera = useCallback((config: MapCameraSetConfig) => {
    if ((config as { type?: string }).type === 'CameraStops') {
      const stops = (config as { stops: MapCameraStop[] }).stops;
      const last = stops?.[stops.length - 1];
      if (last) applyCameraStop(cameraRef.current, last);
      return;
    }
    applyCameraStop(cameraRef.current, config as MapCameraStop);
  }, []);

  useImperativeHandle(
    ref,
    () => ({ animateToRegion, zoomIn, zoomOut, resetCamera, setMapCamera }),
    [animateToRegion, zoomIn, zoomOut, resetCamera, setMapCamera],
  );

  const onMapReady = useCallback(() => {
    onDidFinishLoadingMap?.();
    onDidFinishLoadingStyle?.();
  }, [onDidFinishLoadingMap, onDidFinishLoadingStyle]);

  if (!token) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackText}>Mapa indisponível</Text>
        <Text style={styles.fallbackSub}>
          Defina EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN no .env na raiz, rode o prestart (copia o .env), reinicie o Metro com --clear e abra de novo o app.
        </Text>
      </View>
    );
  }

  return (
    <View style={[{ flex: 1 }, style]}>
      <MapView
        style={StyleSheet.absoluteFill}
        scrollEnabled={scrollEnabled}
        scaleBarEnabled={false}
        onDidFinishLoadingMap={onMapReady}
        onMapIdle={onMapIdle}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: center,
            zoomLevel,
          }}
        />
        {showsUserLocation && UserLocation ? (
          <UserLocation visible androidRenderMode="normal" />
        ) : null}
        {children}
      </MapView>
    </View>
  );
});

const styles = StyleSheet.create({
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E7EB' },
  fallbackText: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 4 },
  fallbackSub: { fontSize: 12, color: '#6B7280', textAlign: 'center', paddingHorizontal: 24 },
});
