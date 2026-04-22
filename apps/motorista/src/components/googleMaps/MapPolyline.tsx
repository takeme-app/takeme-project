import React, { memo, useMemo } from 'react';
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

/**
 * LineLayer em ShapeSource — renderizado em GPU pelo Mapbox.
 *
 * Performance:
 *  - O GeoJSON (`shape`) e o objeto de estilo são memoizados para evitar recriar
 *    a cada render do pai (mesmos valores ⇒ mesma referência ⇒ Mapbox não refaz trabalho).
 *  - O componente é memoizado (React.memo): se `coordinates` chegar como referência
 *    estável (useMemo no pai), re-renders do pai não afetam este nó.
 */
function MapPolylineComponent({
  id = 'route',
  coordinates,
  strokeColor = '#C9A227',
  strokeWidth = 4,
  lineOpacity = 1,
  aboveLayerID,
  layerIndex,
  lineDasharray,
}: Props) {
  const validCoords = useMemo<LatLng[]>(() => {
    const out: LatLng[] = [];
    for (const c of coordinates) {
      const lng = parseFloat(String(c.longitude));
      const lat = parseFloat(String(c.latitude));
      if (Number.isFinite(lng) && Number.isFinite(lat)) out.push({ latitude: lat, longitude: lng });
    }
    return out;
  }, [coordinates]);

  const hasDash = Boolean(lineDasharray && lineDasharray.length >= 2);
  // Traço: `round` + dash costuma sumir ou ficar irregular no Mapbox nativo; `butt` é o recomendado.
  const lineStyle = useMemo(
    () => ({
      lineColor: strokeColor,
      lineWidth: strokeWidth,
      lineOpacity,
      lineCap: (hasDash ? 'butt' : 'round') as 'butt' | 'round',
      lineJoin: (hasDash ? 'miter' : 'round') as 'miter' | 'round',
      ...(hasDash ? { lineDasharray } : {}),
    }),
    [strokeColor, strokeWidth, lineOpacity, hasDash, lineDasharray],
  );

  const geojson = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: validCoords.map((c) => [c.longitude, c.latitude]),
      },
    }),
    [validCoords],
  );

  if (validCoords.length < 2) return null;

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

export const MapPolyline = memo(MapPolylineComponent);
