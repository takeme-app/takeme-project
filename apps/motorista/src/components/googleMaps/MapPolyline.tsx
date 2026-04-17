import React from 'react';
import { ShapeSource, LineLayer } from '@rnmapbox/maps';
import type { LatLng } from './geometry';

type Props = {
  id?: string;
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
  /** 0–1; default 1 */
  lineOpacity?: number;
  /** Inserir a camada acima deste id do estilo Mapbox (ex.: `road-motorway-trunk`). */
  aboveLayerID?: string;
  /** Ordem relativa no estilo (útil para ficar acima de outras camadas custom). */
  layerIndex?: number;
  /** Traço: alternância traço / vão em unidades de largura de linha (Mapbox). Só traço contínuo se omitido. */
  lineDasharray?: number[];
};

export function MapPolyline({
  id = 'route',
  coordinates,
  strokeColor = '#C9A227',
  strokeWidth = 4,
  lineOpacity = 1,
  aboveLayerID,
  layerIndex,
  lineDasharray,
}: Props) {
  const valid: LatLng[] = [];
  for (const c of coordinates) {
    const lng = parseFloat(String(c.longitude));
    const lat = parseFloat(String(c.latitude));
    if (Number.isFinite(lng) && Number.isFinite(lat)) valid.push({ latitude: lat, longitude: lng });
  }
  if (valid.length < 2) return null;

  const hasDash = Boolean(lineDasharray && lineDasharray.length >= 2);
  // Traço: `round` + dash costuma sumir ou ficar irregular no Mapbox nativo; `butt` é o recomendado.
  const lineStyle = {
    lineColor: strokeColor,
    lineWidth: strokeWidth,
    lineOpacity,
    lineCap: (hasDash ? 'butt' : 'round') as 'butt' | 'round',
    lineJoin: (hasDash ? 'miter' : 'round') as 'miter' | 'round',
    ...(hasDash ? { lineDasharray } : {}),
  };

  const geojson = {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: valid.map((c) => [c.longitude, c.latitude]),
    },
  };

  return (
    <ShapeSource id={`${id}-source`} shape={geojson} lineMetrics={false}>
      <LineLayer
        id={`${id}-layer`}
        {...(aboveLayerID ? { aboveLayerID } : {})}
        {...(typeof layerIndex === 'number' ? { layerIndex } : {})}
        style={lineStyle}
      />
    </ShapeSource>
  );
}
