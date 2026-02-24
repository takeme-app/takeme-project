import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../navigation/ProfileStackTypes';

type Props = NativeStackScreenProps<ProfileStackParamList, 'CancellationPolicy'>;

export function CancellationPolicyScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Política de cancelamento de viagens</Text>
        <Text style={styles.updated}>Última atualização: [data genérica]</Text>
        <Text style={styles.paragraph}>
          Saiba como funcionam prazos e reembolsos em cancelamentos. Os prazos podem variar conforme o tipo de serviço e a antecedência do cancelamento.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f1f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    marginTop: 60,
    marginBottom: 16,
  },
  backArrow: { fontSize: 22, color: '#0d0d0d', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '700', color: '#0d0d0d', marginBottom: 8 },
  updated: { fontSize: 13, color: '#767676', marginBottom: 24 },
  paragraph: { fontSize: 15, color: '#374151', lineHeight: 22 },
});
