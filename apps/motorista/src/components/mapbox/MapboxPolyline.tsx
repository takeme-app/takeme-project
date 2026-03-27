import React from 'react';
import type { LatLng } from './mapboxUtils';

// Defensive require — falls back gracefully when native module not compiled yet.
let ShapeSource: any = null;
let LineLayer: any = null;
try {
  const rnmapbox = require('@rnmapbox/maps');
  ShapeSource = rnmapbox.ShapeSource;
  LineLayer = rnmapbox.LineLayer;
} catch {
  // Native module not linked.
}

type Props = { id?: string; coordinates: LatLng[]; strokeColor?: string; strokeWidth?: number };

export function MapboxPolyline({ id = 'route', coordinates, strokeColor = '#C9A227', strokeWidth = 4 }: Props) {
  if (!ShapeSource || !LineLayer || !coordinates.length) return null;
  const geojson = {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: coordinates.map((c) => [c.longitude, c.latitude]) },
  };
  return (
    <ShapeSource id={`${id}-source`} shape={geojson}>
      <LineLayer id={`${id}-layer`} style={{ lineColor: strokeColor, lineWidth: strokeWidth }} />
    </ShapeSource>
  );
}
