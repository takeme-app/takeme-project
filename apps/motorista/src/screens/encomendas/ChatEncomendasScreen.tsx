import { View, StyleSheet } from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { SCREEN_TOP_EXTRA_PADDING } from '../../theme/screenLayout';

export function ChatEncomendasScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}><Text style={styles.title}>Chat</Text></View>
      <View style={styles.empty}>
        <MaterialIcons name="message" size={48} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>Nenhuma conversa</Text>
        <Text style={styles.emptyDesc}>Suas conversas com clientes aparecerão aqui.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingTop: 12 + SCREEN_TOP_EXTRA_PADDING, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
});
