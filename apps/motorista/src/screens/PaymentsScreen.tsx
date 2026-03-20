import { View, StyleSheet } from 'react-native';
import { Text } from '../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Payments'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function PaymentsScreen(_props: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.title}>Pagamentos</Text>
        <Text style={styles.sub}>Histórico e repasses em breve.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 8 },
  sub: { fontSize: 15, color: '#6B7280', lineHeight: 22 },
});
