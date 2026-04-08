import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/types';
import { MaterialIcons } from '@expo/vector-icons';
import { SCREEN_TOP_EXTRA_PADDING } from '../../theme/screenLayout';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Settings'>;

const CARD_BG = '#F2F2F2';

export function ConfiguracoesExcursoesScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerSide} />
          <Text style={styles.headerTitle}>Configurações</Text>
          <View style={styles.headerSide}>
            <TouchableOpacity
              style={styles.bellButton}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Notifications')}
            >
              <MaterialIcons name="notifications-none" size={22} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.pageTitle}>Configurações</Text>

        <View style={styles.topRow}>
          <TouchableOpacity
            style={[styles.card, styles.cardHalf]}
            onPress={() => navigation.navigate('ProfileOverview')}
            activeOpacity={0.75}
          >
            <MaterialIcons name="person-outline" size={28} color="#111827" />
            <Text style={styles.cardLabel}>Perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.card, styles.cardHalf]}
            onPress={() => navigation.navigate('About')}
            activeOpacity={0.75}
          >
            <MaterialIcons name="info-outline" size={28} color="#111827" />
            <Text style={styles.cardLabel}>Sobre</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.card, styles.cardFull]}
          onPress={() => navigation.navigate('ExcursionSchedule')}
          activeOpacity={0.75}
        >
          <MaterialIcons name="calendar-today" size={28} color="#111827" />
          <Text style={styles.cardLabel}>Cronograma</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: SCREEN_TOP_EXTRA_PADDING,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerSide: { width: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 24,
  },
  topRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 118,
  },
  cardHalf: { flex: 1 },
  cardFull: { width: '100%' },
  cardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginTop: 12,
  },
});
