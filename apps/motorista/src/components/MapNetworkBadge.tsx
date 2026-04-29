import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Text } from './Text';

type Props = {
  online: boolean;
  /** Mostrar o badge mesmo online (verde "online"). Default: false. */
  showWhenOnline?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Badge sutil para o overlay do mapa indicar quando estamos sem internet
 * (basemap segue funcionando se houver pack offline; rota/ETA não).
 *
 * Posicionamento: o componente é apenas a "pílula"; o pai é responsável por
 * colocar dentro de um wrapper absoluto com `top` desejado.
 */
export function MapNetworkBadge({ online, showWhenOnline = false, style }: Props) {
  if (online && !showWhenOnline) return null;
  return (
    <View
      style={[
        styles.pill,
        online ? styles.pillOnline : styles.pillOffline,
        style,
      ]}
      pointerEvents="none"
    >
      <MaterialIcons
        name={online ? 'wifi' : 'wifi-off'}
        size={14}
        color={online ? '#15803d' : '#fff'}
      />
      <Text
        style={[
          styles.text,
          online ? styles.textOnline : styles.textOffline,
        ]}
      >
        {online ? 'Online' : 'Sem internet — mapa offline'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pillOffline: {
    backgroundColor: 'rgba(17,24,39,0.92)',
  },
  pillOnline: {
    backgroundColor: '#DCFCE7',
  },
  text: { fontSize: 12, fontWeight: '600' },
  textOffline: { color: '#fff' },
  textOnline: { color: '#15803d' },
});
