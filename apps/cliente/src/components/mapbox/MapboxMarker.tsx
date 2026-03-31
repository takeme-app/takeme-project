import React from 'react';
import { View, TouchableOpacity, Image, type ImageSourcePropType } from 'react-native';
import { PointAnnotation, MarkerView } from '@rnmapbox/maps';
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
 * Marcador no Mapbox.
 * - Com `icon` ou `children` usa MarkerView (tamanho fixo em pixels).
 * - Sem nenhum usa PointAnnotation com pin padrão.
 */
export function MapboxMarker({
  id,
  coordinate,
  anchor = { x: 0.5, y: 1 },
  title,
  description,
  pinColor = '#0d0d0d',
  icon,
  iconSize = 20,
  children,
  onPress,
}: MapboxMarkerProps) {
  if (!isValidTripCoordinate(coordinate.latitude, coordinate.longitude)) {
    return null;
  }

  const coord: [number, number] = [coordinate.longitude, coordinate.latitude];

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
