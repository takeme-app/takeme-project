import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Text } from '../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../navigation/types';
import { MaterialIcons } from '@expo/vector-icons';
import { SCREEN_TOP_EXTRA_PADDING } from '../theme/screenLayout';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Settings'>;

type GridItem = {
  key: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  fullWidth?: boolean;
};

export function SettingsScreen({ navigation }: Props) {
  const hasUnreadNotifications = useUnreadNotifications();

  const topRow: GridItem[] = [
    {
      key: 'perfil',
      label: 'Perfil',
      icon: 'person-outline',
      onPress: () => navigation.navigate('ProfileOverview'),
      fullWidth: true,
    },
  ];

  const grid: GridItem[] = [
    {
      key: 'conversas',
      label: 'Conversas',
      icon: 'chat',
      onPress: () => navigation.navigate('Conversations'),
    },
    {
      key: 'veiculos',
      label: 'Meus veículos',
      icon: 'directions-car',
      onPress: () => navigation.navigate('WorkerVehicles'),
    },
    {
      key: 'rotas',
      label: 'Minhas rotas',
      icon: 'map',
      onPress: () => navigation.navigate('WorkerRoutes'),
    },
    {
      key: 'notif',
      label: 'Notificações',
      icon: 'notifications-none',
      onPress: () => navigation.navigate('Notifications'),
    },
    {
      key: 'cronograma',
      label: 'Cronograma de viagens',
      icon: 'calendar-today',
      onPress: () => navigation.navigate('TripSchedule'),
    },
    {
      key: 'sobre',
      label: 'Sobre',
      icon: 'info-outline',
      onPress: () => navigation.navigate('About'),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Configurações</Text>

        {topRow.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.card, styles.cardFull]}
            onPress={item.onPress}
            activeOpacity={0.75}
          >
            <MaterialIcons name={item.icon} size={28} color="#111827" />
            <Text style={styles.cardLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.grid}>
          {grid.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.card,
                styles.cardHalf,
                item.key === 'notif' && styles.cardHalfWithBadge,
              ]}
              onPress={item.onPress}
              activeOpacity={0.75}
            >
              {item.key === 'notif' && hasUnreadNotifications ? (
                <View pointerEvents="none" style={styles.unreadDotOnCard} />
              ) : null}
              <MaterialIcons name={item.icon} size={26} color="#111827" />
              <Text style={styles.cardLabelSmall}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: SCREEN_TOP_EXTRA_PADDING },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  cardFull: {
    width: '100%',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'flex-start',
    minHeight: 72,
    marginBottom: 12,
  },
  cardHalf: {
    width: '48%',
    flexGrow: 1,
    maxWidth: '48%',
  },
  cardHalfWithBadge: { position: 'relative' },
  cardLabel: { fontSize: 17, fontWeight: '600', color: '#111827' },
  cardLabelSmall: { fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'center', marginTop: 10 },
  /** Mesmo verde do tab Perfil (notificações não lidas no app motorista). */
  unreadDotOnCard: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
  },
});
