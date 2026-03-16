import { View, StyleSheet } from 'react-native';
import { Text } from '../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../navigation/MainTabs';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

export function HomeScreen(_props: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.title}>Ambiente médico</Text>
        <Text style={styles.subtitle}>Em breve: funcionalidades do ambiente médico.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#0d0d0d', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#767676', textAlign: 'center' },
});
