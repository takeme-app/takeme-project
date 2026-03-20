import { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Text } from '../components/Text';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { SCREEN_TOP_EXTRA_PADDING } from '../theme/screenLayout';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Activities'>,
  NativeStackScreenProps<RootStackParamList>
>;

type Booking = {
  id: string;
  passenger_count: number | null;
  bags_count: number | null;
  status: string;
};

type RawTrip = {
  id: string;
  origin_address: string;
  destination_address: string;
  departure_at: string;
  bags_available: number | null;
  status: string;
  bookings: Booking[];
};

type TripRow = {
  id: string;
  origin_address: string;
  destination_address: string;
  departure_at: string;
  bags_available: number;
  status: string;
  confirmedBookings: Booking[];
  passengerCount: number;
  bagsUsed: number;
  occupationPct: number;
  isConfirmed: boolean;
};

type FilterCategory = 'Todas' | 'Viagens' | 'Envios' | 'Dependentes';

function formatTripCode(id: string): string {
  return 'VG' + id.replace(/-/g, '').slice(0, 6).toUpperCase();
}

function shortAddr(addr: string): string {
  const parts = addr.split(',');
  return parts[0]?.trim() ?? addr;
}

function formatDeparture(iso: string): string {
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const month = monthNames[d.getMonth()] ?? '';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} • ${hours}:${minutes}`;
  } catch {
    return '—';
  }
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function buildTripRow(raw: RawTrip): TripRow {
  const confirmedBookings = (raw.bookings ?? []).filter(
    (b) => b.status === 'confirmed' || b.status === 'paid',
  );
  const passengerCount = confirmedBookings.reduce(
    (s, b) => s + (b.passenger_count ?? 0),
    0,
  );
  const bagsUsed = confirmedBookings.reduce(
    (s, b) => s + (b.bags_count ?? 0),
    0,
  );
  const bagsAvailable = raw.bags_available ?? 0;
  const occupationPct =
    bagsAvailable > 0 ? Math.round((bagsUsed / bagsAvailable) * 100) : 0;
  const isConfirmed = raw.status === 'active' || confirmedBookings.length > 0;

  return {
    id: raw.id,
    origin_address: raw.origin_address,
    destination_address: raw.destination_address,
    departure_at: raw.departure_at,
    bags_available: bagsAvailable,
    status: raw.status,
    confirmedBookings,
    passengerCount,
    bagsUsed,
    occupationPct,
    isConfirmed,
  };
}

function TripCard({
  trip,
  onPress,
}: {
  trip: TripRow;
  onPress: () => void;
}) {
  const isConfirmed = trip.isConfirmed;
  const isPlannedNoPassengers =
    !isConfirmed && trip.confirmedBookings.length === 0;
  const hasPassengers = trip.passengerCount > 0;
  const hasPackages = trip.bagsUsed > 0;

  return (
    <View style={styles.card}>
      {/* Row 1: code + badge */}
      <View style={styles.cardRow}>
        <Text style={styles.tripCode}>{formatTripCode(trip.id)}</Text>
        <View
          style={[
            styles.badge,
            isConfirmed ? styles.badgeConfirmed : styles.badgePlanned,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              isConfirmed ? styles.badgeTextConfirmed : styles.badgeTextPlanned,
            ]}
          >
            {isConfirmed ? 'Confirmada' : 'Planejada'}
          </Text>
        </View>
      </View>

      {/* Row 2: route */}
      <View style={styles.routeRow}>
        <Text style={styles.routeText} numberOfLines={1}>
          {shortAddr(trip.origin_address)}
        </Text>
        <MaterialIcons
          name="arrow-forward"
          size={16}
          color="#6B7280"
          style={styles.routeArrow}
        />
        <Text style={styles.routeText} numberOfLines={1}>
          {shortAddr(trip.destination_address)}
        </Text>
      </View>

      {/* Row 3: date */}
      <Text style={styles.dateText}>{formatDeparture(trip.departure_at)}</Text>

      {/* Row 4: content type */}
      {(hasPassengers || hasPackages) && (
        <View style={styles.contentRow}>
          {hasPassengers && (
            <View style={styles.contentItem}>
              <Text style={styles.contentLabel}>Passageiros</Text>
              <Text style={styles.contentValue}>
                {trip.passengerCount} passageiros
              </Text>
            </View>
          )}
          {hasPackages && (
            <View style={styles.contentItem}>
              <Text style={styles.contentLabel}>Encomendas</Text>
              <Text style={styles.contentValue}>{trip.bagsUsed} pacotes</Text>
            </View>
          )}
        </View>
      )}

      {/* Occupation bar */}
      <View style={styles.barContainer}>
        <View style={[styles.barFill, { width: `${trip.occupationPct}%` as any }]} />
      </View>
      <Text style={styles.barLabel}>
        Ocupação do bagageiro: {trip.occupationPct}%
      </Text>

      {/* Bottom link */}
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.linkBtn}>
        <Text style={styles.linkText}>
          {isPlannedNoPassengers ? 'Editar rota' : 'Ver detalhes'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export function ActivitiesScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [confirmedTrips, setConfirmedTrips] = useState<TripRow[]>([]);
  const [plannedTrips, setPlannedTrips] = useState<TripRow[]>([]);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('Todas');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [appliedCategory, setAppliedCategory] = useState<FilterCategory>('Todas');
  const [appliedDateStart, setAppliedDateStart] = useState('');
  const [appliedDateEnd, setAppliedDateEnd] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setConfirmedTrips([]);
      setPlannedTrips([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('scheduled_trips')
      .select(
        'id, origin_address, destination_address, departure_at, bags_available, status, bookings(id, passenger_count, bags_count, status)',
      )
      .eq('driver_id', user.id)
      .in('status', ['active', 'scheduled'])
      .order('departure_at', { ascending: true });

    const rawTrips = (data ?? []) as RawTrip[];
    const rows = rawTrips.map(buildTripRow);

    let filtered = rows;

    // Apply date filter
    if (appliedDateStart) {
      const start = new Date(appliedDateStart + 'T00:00:00');
      filtered = filtered.filter(
        (t) => new Date(t.departure_at) >= start,
      );
    }
    if (appliedDateEnd) {
      const end = new Date(appliedDateEnd + 'T23:59:59');
      filtered = filtered.filter(
        (t) => new Date(t.departure_at) <= end,
      );
    }

    setConfirmedTrips(filtered.filter((t) => t.isConfirmed));
    setPlannedTrips(filtered.filter((t) => !t.isConfirmed));
    setLoading(false);
  }, [appliedDateStart, appliedDateEnd]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openFilter = () => {
    setFilterCategory(appliedCategory);
    setFilterDateStart(appliedDateStart);
    setFilterDateEnd(appliedDateEnd);
    setFilterVisible(true);
  };

  const applyFilter = () => {
    setAppliedCategory(filterCategory);
    setAppliedDateStart(filterDateStart);
    setAppliedDateEnd(filterDateEnd);
    setFilterVisible(false);
  };

  const goTripDetail = (tripId: string) => {
    navigation.navigate('TripDetail', { tripId });
  };

  const goTripHistory = () => {
    navigation.navigate('TripHistory');
  };

  const categories: FilterCategory[] = ['Todas', 'Viagens', 'Envios', 'Dependentes'];

  const isEmpty = !loading && confirmedTrips.length === 0 && plannedTrips.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Suas corridas</Text>
        <TouchableOpacity
          onPress={openFilter}
          activeOpacity={0.7}
          style={styles.filterBtn}
        >
          <MaterialIcons name="tune" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Large title + history chip */}
        <Text style={styles.screenTitle}>Atividades</Text>
        <TouchableOpacity
          onPress={goTripHistory}
          activeOpacity={0.7}
          style={styles.historyChip}
        >
          <Text style={styles.historyChipText}>⏱ Histórico de Viagens</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#C9A227" />
          </View>
        ) : isEmpty ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nenhuma atividade por enquanto.</Text>
          </View>
        ) : (
          <>
            {confirmedTrips.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Viagens confirmadas</Text>
                {confirmedTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    onPress={() => goTripDetail(trip.id)}
                  />
                ))}
              </>
            )}

            {plannedTrips.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Viagens planejadas</Text>
                {plannedTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    onPress={() => goTripDetail(trip.id)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={filterVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterVisible(false)}
        />
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Filtrar atividades</Text>

          {/* Category chips */}
          <View style={styles.chipRow}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setFilterCategory(cat)}
                activeOpacity={0.7}
                style={[
                  styles.categoryChip,
                  filterCategory === cat && styles.categoryChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    filterCategory === cat && styles.categoryChipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date section */}
          <Text style={styles.dateLabel}>Data da atividade</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateInputWrap}>
              <Text style={styles.dateInputLabel}>Data inicial</Text>
              <TextInput
                style={styles.dateInput}
                value={filterDateStart ? formatDateDisplay(filterDateStart) : ''}
                placeholder="dd/mm/aaaa"
                placeholderTextColor="#9CA3AF"
                onChangeText={(text) => {
                  // Accept YYYY-MM-DD from raw or parse dd/mm/yyyy
                  const digits = text.replace(/\D/g, '');
                  if (digits.length === 8) {
                    const day = digits.slice(0, 2);
                    const month = digits.slice(2, 4);
                    const year = digits.slice(4, 8);
                    setFilterDateStart(`${year}-${month}-${day}`);
                  } else if (text === '') {
                    setFilterDateStart('');
                  }
                }}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                maxLength={10}
              />
            </View>
            <View style={styles.dateInputWrap}>
              <Text style={styles.dateInputLabel}>Data final</Text>
              <TextInput
                style={styles.dateInput}
                value={filterDateEnd ? formatDateDisplay(filterDateEnd) : ''}
                placeholder="dd/mm/aaaa"
                placeholderTextColor="#9CA3AF"
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, '');
                  if (digits.length === 8) {
                    const day = digits.slice(0, 2);
                    const month = digits.slice(2, 4);
                    const year = digits.slice(4, 8);
                    setFilterDateEnd(`${year}-${month}-${day}`);
                  } else if (text === '') {
                    setFilterDateEnd('');
                  }
                }}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                maxLength={10}
              />
            </View>
          </View>

          {/* Apply button */}
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={applyFilter}
            activeOpacity={0.85}
          >
            <Text style={styles.applyBtnText}>Aplicar filtro</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const GOLD = '#C9A227';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: SCREEN_TOP_EXTRA_PADDING,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerSpacer: { width: 40 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    flex: 1,
  },
  filterBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  historyChip: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  historyChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },

  // Section title
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: GOLD,
    marginBottom: 12,
    marginTop: 20,
  },

  // Empty / loading
  center: { paddingTop: 60, alignItems: 'center' },
  emptyState: { paddingTop: 80, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#9CA3AF', textAlign: 'center' },

  // Trip card
  card: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tripCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  badgeConfirmed: { backgroundColor: '#D1FAE5' },
  badgePlanned: { backgroundColor: '#F3F4F6' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextConfirmed: { color: '#065F46' },
  badgeTextPlanned: { color: '#374151' },

  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
  },
  routeArrow: { marginHorizontal: 4 },

  dateText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 10,
  },

  contentRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 10,
  },
  contentItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contentLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  contentValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },

  barContainer: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginVertical: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  barLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },

  linkBtn: { alignItems: 'center', paddingTop: 4 },
  linkText: {
    fontSize: 14,
    color: '#111827',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },

  // Modal / bottom sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  categoryChip: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  categoryChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },

  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  dateInputWrap: { flex: 1 },
  dateInputLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },

  applyBtn: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
