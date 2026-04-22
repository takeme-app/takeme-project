import React, { memo, useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { PointAnnotation, MarkerView } from '@rnmapbox/maps';
import type { LatLng } from './geometry';

type MapMarkerProps = {
  id: string;
  coordinate: LatLng;
  anchor?: { x: number; y: number };
  pinColor?: string;
  children?: React.ReactNode;
  onPress?: () => void;
};

/**
 * Marcador no Mapbox (motorista).
 * - Com `children` usa MarkerView (conteúdo React customizado).
 * - Sem children usa PointAnnotation com pin padrão.
 *
 * Performance:
 *  - O componente é memoizado (React.memo): não re-renderiza quando o pai re-renderiza
 *    com as mesmas props (evita trabalho em cascata quando o GPS/state da tela muda).
 *  - A coordenada é passada como referência estável (memoizada) e NÃO usamos `key`
 *    derivada da coordenada — MarkerView/PointAnnotation do `@rnmapbox/maps` ≥ 10 já
 *    reposicionam o nativo ao mudar `coordinate`, então forçar remount só gera jank.
 */
function MapMarkerComponent({
  id,
  coordinate,
  anchor = { x: 0.5, y: 1 },
  pinColor = '#111827',
  children,
  onPress,
}: MapMarkerProps) {
  const lat = parseFloat(String(coordinate.latitude));
  const lng = parseFloat(String(coordinate.longitude));
  const coord = useMemo<[number, number] | null>(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lng, lat];
  }, [lat, lng]);

  if (!coord) return null;

  if (children) {
    const content = onPress ? (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
    ) : (
      children
    );
    return (
      <MarkerView id={id} coordinate={coord} anchor={anchor} allowOverlap>
        <View collapsable={false}>{content}</View>
      </MarkerView>
    );
  }

  return (
    <PointAnnotation id={id} coordinate={coord} anchor={anchor}>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: pinColor,
          borderWidth: 2,
          borderColor: '#FFFFFF',
        }}
      />
    </PointAnnotation>
  );
}

function areMapMarkerPropsEqual(prev: MapMarkerProps, next: MapMarkerProps): boolean {
  if (prev.id !== next.id) return false;
  if (prev.pinColor !== next.pinColor) return false;
  if (prev.onPress !== next.onPress) return false;
  if (prev.children !== next.children) return false;
  const pa = prev.anchor;
  const na = next.anchor;
  if ((pa?.x ?? 0.5) !== (na?.x ?? 0.5)) return false;
  if ((pa?.y ?? 1) !== (na?.y ?? 1)) return false;
  if (prev.coordinate.latitude !== next.coordinate.latitude) return false;
  if (prev.coordinate.longitude !== next.coordinate.longitude) return false;
  return true;
}

export const MapMarker = memo(MapMarkerComponent, areMapMarkerPropsEqual);
