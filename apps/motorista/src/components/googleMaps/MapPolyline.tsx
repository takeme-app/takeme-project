import React from 'react';
import { ShapeSource, LineLayer } from '@rnmapbox/maps';
import type { LatLng } from './geometry';

type Props = { id?: string; coordinates: LatLng[]; strokeColor?: string; strokeWidth?: number };

export function MapPolyline({
  id = 'route',
  coordinates,
  strokeColor = '#C9A227',
  strokeWidth = 4,
}: Props) {
  const valid: LatLng[] = [];
  for (const c of coordinates) {
    const lng = parseFloat(String(c.longitude));
    const lat = parseFloat(String(c.latitude));
    if (Number.isFinite(lng) && Number.isFinite(lat)) valid.push({ latitude: lat, longitude: lng });
  }
  if (valid.length < 2) return null;

  const geojson = {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: valid.map((c) => [c.longitude, c.latitude]),
    },
  };

  return (
    <ShapeSource id={`${id}-source`} shape={geojson}>
      <LineLayer
        id={`${id}-layer`}
        style={{
          lineColor: strokeColor,
          lineWidth: strokeWidth,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </ShapeSource>
  );
}
