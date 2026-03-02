import { View, StyleSheet } from 'react-native';
import { Text } from './Text';

const BLUE = '#2563eb';

/**
 * Marcador "Sua localização" no mapa: etiqueta azul com texto + linha + círculo (pin).
 * Anchor no Marker: { x: 0.5, y: 1 } (ponta do pin no ponto do mapa).
 */
export function MyLocationMarkerIcon() {
  return (
    <View style={styles.wrap}>
      <View style={styles.label}>
        <Text style={styles.labelText}>Sua localização</Text>
      </View>
      <View style={styles.line} />
      <View style={styles.pin}>
        <View style={styles.pinDot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  label: {
    backgroundColor: BLUE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  labelText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  line: {
    width: 2,
    height: 8,
    backgroundColor: BLUE,
  },
  pin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -1,
  },
  pinDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
});
