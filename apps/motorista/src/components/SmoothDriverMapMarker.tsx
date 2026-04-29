import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MapMarker } from './googleMaps';
import { useSmoothCoordinate } from '../hooks/useSmoothCoordinate';

const DARK = '#111827';
const MAP_MARKER_CENTER_ANCHOR = { x: 0.5, y: 0.5 } as const;

type Props = {
  /** Posição-alvo (já throttled); o componente desliza até ela via RAF. */
  targetLatitude: number;
  targetLongitude: number;
  /**
   * Em modo seguir (heading-up), o mapa rotaciona pelo bearing — então o
   * ícone fica fixo (0°) para não rotacionar duas vezes. Sem follow, aplica
   * o `targetHeadingDeg` no transform do ícone interno.
   */
  following: boolean;
  /** Direção do movimento; `null` quando o GPS não tem heading confiável. */
  targetHeadingDeg?: number | null;
  /** Id do marker no Mapbox; padronize por tela quando houver mais de um pin. */
  id?: string;
  /** Duração da interpolação da posição em ms. Default 240 ms. */
  positionDurationMs?: number;
  /** Duração da interpolação do heading em ms. Default 220 ms. */
  headingDurationMs?: number;
};

/**
 * Pin do motorista com **interpolação suave** entre fixes do GPS (estilo Waze).
 * Isolado em componente próprio para que o `requestAnimationFrame` (~60 fps)
 * só re-renderize ESTE marker — e não a tela inteira (mapa + overlays).
 */
export const SmoothDriverMapMarker = memo(function SmoothDriverMapMarker({
  targetLatitude,
  targetLongitude,
  following,
  targetHeadingDeg = null,
  id = 'driver',
  positionDurationMs,
  headingDurationMs = 220,
}: Props) {
  const { coord, headingDeg } = useSmoothCoordinate(
    { latitude: targetLatitude, longitude: targetLongitude },
    targetHeadingDeg ?? null,
    { durationMs: positionDurationMs, headingDurationMs },
  );
  const lat = coord?.latitude ?? targetLatitude;
  const lng = coord?.longitude ?? targetLongitude;
  const rotate =
    !following && typeof headingDeg === 'number' && headingDeg >= 0
      ? `${headingDeg}deg`
      : '0deg';
  return (
    <MapMarker
      id={id}
      coordinate={{ latitude: lat, longitude: lng }}
      anchor={MAP_MARKER_CENTER_ANCHOR}
    >
      <View style={styles.driverPulse}>
        <View style={[styles.driverMarker, { transform: [{ rotate }] }]}>
          <MaterialIcons
            name={following ? 'navigation' : headingDeg != null ? 'navigation' : 'play-arrow'}
            size={18}
            color="#fff"
          />
        </View>
      </View>
    </MapMarker>
  );
});

const styles = StyleSheet.create({
  driverPulse: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(17,24,39,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: DARK,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
});
