import type { RefObject } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { GoogleMapsMapRef } from './GoogleMapsMap';

const DARK = '#111827';

type Props = {
  mapRef: RefObject<GoogleMapsMapRef | null>;
  /** Posicionamento absoluto (ex.: { position: 'absolute', left: 14, top: 118 }) */
  style?: StyleProp<ViewStyle>;
  gap?: number;
};

export function MapZoomControls({ mapRef, style, gap = 6 }: Props) {
  return (
    <View style={[styles.column, { gap }, style]} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.btn}
        onPress={() => mapRef.current?.zoomIn()}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Aumentar zoom"
      >
        <MaterialIcons name="add" size={22} color={DARK} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => mapRef.current?.zoomOut()}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Diminuir zoom"
      >
        <MaterialIcons name="remove" size={22} color={DARK} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: 'center',
  },
  btn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: Platform.OS === 'android' ? 5 : 0,
  },
});
