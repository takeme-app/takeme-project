import {
  TouchableOpacity,
  View,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const DARK = '#111827';

export type DriverLocationFocusButtonProps = {
  onPress: () => void;
  /** Mesmo estado visual do marcador no mapa (viagem ativa / navegação). */
  following: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  activeOpacity?: number;
  label?: string;
  accessibilityLabel?: string;
};

/**
 * Botão “focar na minha posição”: mesmo desenho do puck do motorista no mapa
 * (círculo escuro, borda branca, seta), não o ícone de mira do Material.
 */
export function DriverLocationFocusButton({
  onPress,
  following,
  disabled,
  style,
  activeOpacity = 0.8,
  label,
  accessibilityLabel,
}: DriverLocationFocusButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.wrap,
        label ? styles.wrapWithLabel : null,
        disabled ? styles.wrapDisabled : null,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={activeOpacity}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? 'Focar na minha localização'}
    >
      <View style={styles.driverMarker}>
        <MaterialIcons
          name={following ? 'navigation' : 'play-arrow'}
          size={18}
          color="#fff"
        />
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  wrapWithLabel: {
    width: 'auto',
    minWidth: 126,
    paddingLeft: 4,
    paddingRight: 14,
    flexDirection: 'row',
    gap: 8,
    borderRadius: 23,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  wrapDisabled: {
    opacity: 0.65,
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
  label: {
    color: DARK,
    fontSize: 14,
    fontWeight: '800',
  },
});
