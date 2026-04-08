import type { RefObject } from 'react';
import { View, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { GoogleMapsMapRef } from './GoogleMapsMap';

const DARK = '#111827';

type Props = {
  mapRef: RefObject<GoogleMapsMapRef | null>;
  style?: StyleProp<ViewStyle>;
  /**
   * true: posição absoluta canto inferior direito (mapas em scroll/card).
   * false: só coluna com gap — envolva em um View absoluto no pai (ex.: coleta ativa).
   */
  floating?: boolean;
  /** Ex.: desligar “seguir GPS” — o zoom por botão nem sempre gera gesto no mapa nativo. */
  onBeforeZoom?: () => void;
};

/** + / − nos mapas de excursão e encomendas. */
export function MapZoomControls({ mapRef, style, floating = true, onBeforeZoom }: Props) {
  return (
    <View style={[styles.gapCol, floating && styles.floatBottomEnd, style]} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.btn}
        onPress={() => {
          onBeforeZoom?.();
          mapRef.current?.zoomIn();
        }}
        activeOpacity={0.85}
        accessibilityLabel="Aproximar mapa"
      >
        <MaterialIcons name="add" size={22} color={DARK} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => {
          onBeforeZoom?.();
          mapRef.current?.zoomOut();
        }}
        activeOpacity={0.85}
        accessibilityLabel="Afastar mapa"
      >
        <MaterialIcons name="remove" size={22} color={DARK} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  gapCol: { gap: 6 },
  floatBottomEnd: {
    position: 'absolute',
    right: 10,
    bottom: 10,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
});
