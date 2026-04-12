import React, { useMemo } from 'react';
import { ShapeSource, LineLayer } from '@rnmapbox/maps';
import type { LatLng } from './mapboxUtils';

type MapboxPolylineProps = {
  /** Coordenadas na ordem (origem → destino). Formato { latitude, longitude }. */
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
};

/**
 * Polyline no Mapbox (ShapeSource + LineLayer).
 * Usa o mesmo formato de coordenadas que getRoutePolyline (latitude/longitude).
 */
export function MapboxPolyline({
  coordinates,
  strokeColor = '#0d0d0d',
  strokeWidth = 4,
}: MapboxPolylineProps) {
  const { sourceId, layerId } = useMemo(() => {
    const n = Math.random().toString(36).slice(2, 10);
    return { sourceId: `route-src-${n}`, layerId: `route-layer-${n}` };
  }, []);

  if (!coordinates.length) return null;

  const geojson = {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: coordinates.map((c) => [c.longitude, c.latitude]),
    },
  };

  return (
    <ShapeSource id={sourceId} shape={geojson}>
      <LineLayer
        id={layerId}
        style={{
          lineColor: strokeColor,
          lineWidth: strokeWidth,
        }}
      />
    </ShapeSource>
  );
}
