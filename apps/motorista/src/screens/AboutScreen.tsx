import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Text } from '../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../navigation/types';
import { MaterialIcons } from '@expo/vector-icons';
import { SCREEN_TOP_EXTRA_PADDING } from '../theme/screenLayout';

type Props = NativeStackScreenProps<ProfileStackParamList, 'About'>;

type AboutItem = {
  key: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
};

const ITEMS: AboutItem[] = [
  {
    key: 'privacy',
    icon: 'shield',
    title: 'Política de privacidade',
    subtitle: 'Entenda como tratamos e protegemos seus dados.',
  },
  {
    key: 'terms',
    icon: 'description',
    title: 'Termos de uso',
    subtitle: 'Leia as condições de uso da plataforma.',
  },
  {
    key: 'cancel',
    icon: 'cancel',
    title: 'Política de cancelamento de viagens',
    subtitle: 'Saiba como funcionam prazos e reembolsos em cancelamentos.',
  },
  {
    key: 'data',
    icon: 'assignment-turned-in',
    title: 'Solicitar cópia dos meus dados',
    subtitle: 'Peça acesso aos dados obrigatórios já fornecidos à plataforma.',
  },
  {
    key: 'consent',
    icon: 'description',
    title: 'Termo de consentimento',
    subtitle: 'Entenda como seu consentimento é utilizado para tratamento de dados.',
  },
];

export function AboutScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sobre</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {ITEMS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.card}
            onPress={item.onPress}
            activeOpacity={item.onPress ? 0.75 : 1}
          >
            <View style={styles.iconCircle}>
              <MaterialIcons name={item.icon} size={22} color="#374151" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSub}>{item.subtitle}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8 + SCREEN_TOP_EXTRA_PADDING, paddingBottom: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  scroll: { paddingHorizontal: 20, paddingVertical: 8, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#F3F4F6', borderRadius: 16, padding: 16,
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center',
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#6B7280', lineHeight: 17 },
});
