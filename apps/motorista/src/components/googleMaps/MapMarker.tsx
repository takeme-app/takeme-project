import React from 'react';
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

export function MapMarker({
  id,
  coordinate,
  anchor = { x: 0.5, y: 1 },
  pinColor = '#111827',
  children,
  onPress,
}: MapMarkerProps) {
  const lat = parseFloat(String(coordinate.latitude));
  const lng = parseFloat(String(coordinate.longitude));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const coord: [number, number] = [lng, lat];

  if (children) {
    const content = onPress ? (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
    ) : (
      children
    );
    return (
      <MarkerView key={id} coordinate={coord} anchor={anchor} allowOverlap>
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
