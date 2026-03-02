import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { PointAnnotation, MarkerView } from '@rnmapbox/maps';
import type { LatLng } from './mapboxUtils';

type Anchor = { x: number; y: number };

type MapboxMarkerProps = {
  id: string;
  coordinate: LatLng;
  anchor?: Anchor;
  title?: string;
  description?: string;
  /** Cor do pin padrão quando não há children (ex.: '#0d0d0d', '#dc2626'). */
  pinColor?: string;
  /** Conteúdo customizado (ex.: MyLocationMarkerIcon, DriverMarkerIcon). Mesmas marcações do iOS. */
  children?: React.ReactNode;
  /** Ao tocar no marcador (MarkerView com children). Para PointAnnotation use onSelected do mapa. */
  onPress?: () => void;
};

const defaultPin = (pinColor: string) => (
  <View style={{ width: 24, height: 32, alignItems: 'center', justifyContent: 'flex-end' }}>
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: pinColor,
      }}
    />
  </View>
);

/**
 * Marcador no Mapbox. Com children usa MarkerView (views nativas, igual iOS).
 * Sem children usa PointAnnotation (pin simples).
 */
export function MapboxMarker({
  id,
  coordinate,
  anchor = { x: 0.5, y: 1 },
  title,
  description,
  pinColor = '#0d0d0d',
  children,
  onPress,
}: MapboxMarkerProps) {
  const coord: [number, number] = [coordinate.longitude, coordinate.latitude];

  if (children) {
    const content = onPress ? (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </TouchableOpacity>
    ) : (
      children
    );
    return (
      <MarkerView key={id} coordinate={coord} anchor={anchor} allowOverlap>
        {content}
      </MarkerView>
    );
  }

  return (
    <PointAnnotation
      id={id}
      coordinate={coord}
      anchor={anchor}
      title={title}
      snippet={description}
    >
      {defaultPin(pinColor)}
    </PointAnnotation>
  );
}
