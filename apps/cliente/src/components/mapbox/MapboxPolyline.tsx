import React, { memo, useId, useMemo } from 'react';
import { ShapeSource, LineLayer } from '@rnmapbox/maps';
import { MAPBOX_ROUTE_STROKE_COLOR } from '@take-me/shared';
import type { LatLng } from './mapboxUtils';

type MapboxPolylineProps = {
  /** Coordenadas na ordem (origem → destino). Formato { latitude, longitude }. */
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
};

/**
 * Polyline no Mapbox (ShapeSource + LineLayer).
 *
 * Performance:
 *  - `sourceId`/`layerId` são estáveis por montagem (React `useId`), em vez de
 *    `Math.random()` — evita trocar IDs em StrictMode / dev.
 *  - `shape` (GeoJSON) memoizado para não criar objeto novo a cada render.
 *  - `React.memo`: se `coordinates` vier com referência estável, re-renders do
 *    pai não tocam esta linha.
 */
function MapboxPolylineComponent({
  coordinates,
  strokeColor = MAPBOX_ROUTE_STROKE_COLOR,
  strokeWidth = 4,
}: MapboxPolylineProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const sourceId = `route-src-${uid}`;
  const layerId = `route-layer-${uid}`;

  const geojson = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: coordinates.map((c) => [c.longitude, c.latitude]),
      },
    }),
    [coordinates],
  );

  const lineStyle = useMemo(
    () => ({
      lineColor: strokeColor,
      lineWidth: strokeWidth,
      lineCap: 'round' as const,
      lineJoin: 'round' as const,
    }),
    [strokeColor, strokeWidth],
  );

  if (!coordinates.length) return null;

  return (
    <ShapeSource id={sourceId} shape={geojson}>
      <LineLayer id={layerId} style={lineStyle} />
    </ShapeSource>
  );
}

export const MapboxPolyline = memo(MapboxPolylineComponent);
