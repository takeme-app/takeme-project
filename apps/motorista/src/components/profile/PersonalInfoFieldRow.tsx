import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../Text';
import { MaterialIcons } from '@expo/vector-icons';

const GOLD = '#C9A227';

type Props = {
  label: string;
  value: string;
  onPress?: () => void;
  verified?: boolean;
};

export function PersonalInfoFieldRow({ label, value, onPress, verified }: Props) {
  const content = (
    <>
      <View style={styles.textCol}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} numberOfLines={2}>
          {value}
        </Text>
      </View>
      {verified ? (
        <MaterialIcons name="verified" size={24} color={GOLD} />
      ) : onPress ? (
        <MaterialIcons name="chevron-right" size={22} color="#9CA3AF" />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.65}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 12,
  },
  textCol: { flex: 1 },
  label: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  value: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
});
