import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import Svg, { Path, G, ClipPath, Defs, Rect } from 'react-native-svg';

const SIZE = 32;

type Props = {
  /** Texto do tempo estimado (ex: "5 min"). Omitir para não mostrar badge. */
  eta?: string;
};

/**
 * Marcador do motorista no mapa com badge de ETA.
 * Anchor: { x: 0.5, y: 1 } para a base ficar no ponto.
 */
export function DriverEtaMarkerIcon({ eta }: Props) {
  return (
    <View style={styles.wrap}>
      {eta ? (
        <View style={styles.etaBadge}>
          <Text style={styles.etaText}>{eta}</Text>
        </View>
      ) : null}
      <View style={styles.circle}>
        <Svg width={SIZE} height={SIZE} viewBox="0 0 40 40" fill="none">
          <G clipPath="url(#clip0_driver_eta)">
            <Path
              d="M25.7667 14.175C25.6 13.6834 25.1333 13.3334 24.5833 13.3334H15.4167C14.8667 13.3334 14.4083 13.6834 14.2333 14.175L12.5917 18.9C12.5333 19.075 12.5 19.2584 12.5 19.45V25.4167C12.5 26.1084 13.0583 26.6667 13.75 26.6667C14.4417 26.6667 15 26.1084 15 25.4167V25H25V25.4167C25 26.1 25.5583 26.6667 26.25 26.6667C26.9333 26.6667 27.5 26.1084 27.5 25.4167V19.45C27.5 19.2667 27.4667 19.075 27.4083 18.9L25.7667 14.175ZM15.4167 22.5C14.725 22.5 14.1667 21.9417 14.1667 21.25C14.1667 20.5584 14.725 20 15.4167 20C16.1083 20 16.6667 20.5584 16.6667 21.25C16.6667 21.9417 16.1083 22.5 15.4167 22.5ZM24.5833 22.5C23.8917 22.5 23.3333 21.9417 23.3333 21.25C23.3333 20.5584 23.8917 20 24.5833 20C25.275 20 25.8333 20.5584 25.8333 21.25C25.8333 21.9417 25.275 22.5 24.5833 22.5ZM14.1667 18.3334L15.225 15.15C15.3417 14.8167 15.6583 14.5834 16.0167 14.5834H23.9833C24.3417 14.5834 24.6583 14.8167 24.775 15.15L25.8333 18.3334H14.1667Z"
              fill="#FFFFFF"
            />
          </G>
          <Defs>
            <ClipPath id="clip0_driver_eta">
              <Rect width={20} height={20} fill="white" x={10} y={10} />
            </ClipPath>
          </Defs>
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  etaBadge: {
    backgroundColor: '#0d0d0d',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  etaText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: '#0d0d0d',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
