import React, { memo, useMemo } from 'react';
import { View, TouchableOpacity, Image, type ImageSourcePropType } from 'react-native';
import { PointAnnotation, MarkerView } from '@rnmapbox/maps';
import { MAPBOX_ORIGIN_MARKER_COLOR } from '@take-me/shared';
import type { LatLng } from './mapboxUtils';
import { isValidTripCoordinate } from './mapboxUtils';

type Anchor = { x: number; y: number };

type MapboxMarkerProps = {
  id: string;
  coordinate: LatLng;
  anchor?: Anchor;
  title?: string;
  description?: string;
  /** Cor do pin padrão quando não há children nem icon. */
  pinColor?: string;
  /** Ícone estático via MarkerView (tamanho fixo em pixels, sem distorção). */
  icon?: ImageSourcePropType;
  /** Tamanho do ícone em dp (default 20). */
  iconSize?: number;
  /** Conteúdo customizado (ex.: DriverEtaMarkerIcon). Usa MarkerView. */
  children?: React.ReactNode;
  onPress?: () => void;
};

/** Mesmo visual que `MapMarker` no app motorista (`PointAnnotation`). */
const defaultPin = (pinColor: string) => (
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
);

/**
 * Marcador no Mapbox (cliente).
 * - Com `icon` ou `children` usa MarkerView (tamanho fixo em pixels).
 * - Sem nenhum usa PointAnnotation com pin padrão.
 *
 * Performance:
 *  - `coord` tuple memoizada (evita nova referência a cada render).
 *  - Não usamos `key={id}` no MarkerView (forçava remount quando `id` é estável
 *    mas o pai re-renderiza — o Mapbox ≥ 10 reposiciona o nativo sozinho).
 *  - `React.memo` com comparação custom: re-renders do pai não propagam quando
 *    as props efetivas (lat/lng/cor/onPress/children) são iguais.
 */
function MapboxMarkerComponent({
  id,
  coordinate,
  anchor = { x: 0.5, y: 1 },
  title,
  description,
  pinColor = MAPBOX_ORIGIN_MARKER_COLOR,
  icon,
  iconSize = 20,
  children,
  onPress,
}: MapboxMarkerProps) {
  const valid = isValidTripCoordinate(coordinate.latitude, coordinate.longitude);
  const coord = useMemo<[number, number]>(
    () => [coordinate.longitude, coordinate.latitude],
    [coordinate.longitude, coordinate.latitude],
  );

  if (!valid) return null;

  if (children || icon) {
    let content: React.ReactNode;
    if (children) {
      content = children;
    } else {
      content = (
        <Image
          source={icon!}
          style={{ width: iconSize, height: iconSize }}
          resizeMode="contain"
        />
      );
    }

    if (onPress) {
      content = (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ alignItems: 'center', justifyContent: 'center' }}>
          {content}
        </TouchableOpacity>
      );
    }

    return (
      <MarkerView id={id} coordinate={coord} anchor={anchor} allowOverlap>
        <View collapsable={false}>{content}</View>
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

function areMapboxMarkerPropsEqual(prev: MapboxMarkerProps, next: MapboxMarkerProps): boolean {
  if (prev.id !== next.id) return false;
  if (prev.title !== next.title) return false;
  if (prev.description !== next.description) return false;
  if (prev.pinColor !== next.pinColor) return false;
  if (prev.icon !== next.icon) return false;
  if ((prev.iconSize ?? 20) !== (next.iconSize ?? 20)) return false;
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

export const MapboxMarker = memo(MapboxMarkerComponent, areMapboxMarkerPropsEqual);
