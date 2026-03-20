import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import type { LatLng } from './mapboxUtils';

// Defensive require — falls back gracefully when native module not compiled yet.
let MarkerView: any = null;
let PointAnnotation: any = null;
try {
  const rnmapbox = require('@rnmapbox/maps');
  MarkerView = rnmapbox.MarkerView;
  PointAnnotation = rnmapbox.PointAnnotation;
} catch {
  // Native module not linked.
}

type MapboxMarkerProps = {
  id: string;
  coordinate: LatLng;
  anchor?: { x: number; y: number };
  pinColor?: string;
  children?: React.ReactNode;
  onPress?: () => void;
};

export function MapboxMarker({ id, coordinate, anchor = { x: 0.5, y: 1 }, pinColor = '#111827', children, onPress }: MapboxMarkerProps) {
  if (!MarkerView || !PointAnnotation) return null;

  const coord: [number, number] = [coordinate.longitude, coordinate.latitude];

  if (children) {
    const content = onPress
      ? <TouchableOpacity onPress={onPress} activeOpacity={0.8}>{children}</TouchableOpacity>
      : children;
    return <MarkerView key={id} coordinate={coord} anchor={anchor} allowOverlap>{content}</MarkerView>;
  }

  return (
    <PointAnnotation id={id} coordinate={coord} anchor={anchor}>
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: pinColor }} />
    </PointAnnotation>
  );
}
