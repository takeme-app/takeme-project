import { View, StyleSheet } from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { SCREEN_TOP_EXTRA_PADDING } from '../../theme/screenLayout';

export function PagamentosExcursoesScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}><Text style={styles.title}>Pagamentos</Text></View>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Saldo disponível</Text>
        <Text style={styles.balanceValue}>R$ 0,00</Text>
        <Text style={styles.balanceHint}>Seus ganhos aparecerão aqui após as excursões concluídas.</Text>
      </View>
      <View style={styles.empty}>
        <MaterialIcons name="receipt-long" size={48} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>Sem histórico</Text>
        <Text style={styles.emptyDesc}>Seu histórico de pagamentos aparecerá aqui.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingTop: 12 + SCREEN_TOP_EXTRA_PADDING, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  balanceCard: { margin: 20, padding: 20, backgroundColor: '#111827', borderRadius: 20 },
  balanceLabel: { fontSize: 13, color: '#9CA3AF', marginBottom: 4 },
  balanceValue: { fontSize: 32, fontWeight: '700', color: '#C9A227', marginBottom: 8 },
  balanceHint: { fontSize: 12, color: '#6B7280', lineHeight: 18 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
});
