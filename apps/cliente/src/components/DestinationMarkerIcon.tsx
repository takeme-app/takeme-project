import { View, StyleSheet } from 'react-native';

const BLACK = '#0d0d0d';

/**
 * Marcador de destino no mapa: quadrado preto com borda arredondada.
 * Anchor no Marker: { x: 0.5, y: 1 } (ponta no ponto do mapa).
 */
export function DestinationMarkerIcon() {
  return (
    <View style={styles.wrap}>
      <View style={styles.pin}>
        <View style={styles.pinInner} />
      </View>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  pin: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: BLACK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinInner: {
    width: 6,
    height: 6,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  line: {
    width: 2,
    height: 6,
    backgroundColor: BLACK,
    marginTop: -1,
  },
});
