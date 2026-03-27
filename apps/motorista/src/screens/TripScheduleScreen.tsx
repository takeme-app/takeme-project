import { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Text } from '../components/Text';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { SCREEN_TOP_EXTRA_PADDING } from '../theme/screenLayout';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

type Props = NativeStackScreenProps<ProfileStackParamList, 'TripSchedule'>;

const DAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
// day_of_week: 1=Mon ... 7=Sun (or 0-6)

type TripRow = {
  id: string;
  route_origin: string | null;
  route_destination: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  day_of_week: number;
  vehicle_type: string | null;
  is_active: boolean;
  status: string | null;
};

type DayState = {
  vehicleType: 'principal' | 'reserva';
  statusActive: boolean;
};

export function TripScheduleScreen({ navigation, route }: Props) {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(0);
  const [dayStates, setDayStates] = useState<Record<number, DayState>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { data } = await supabase
        .from('scheduled_trips')
        .select(`
          id, day_of_week, departure_time, arrival_time,
          vehicle_type, is_active, status,
          worker_routes ( origin_address, destination_address )
        `)
        .eq('driver_id', user.id)
        .order('day_of_week', { ascending: true });

      const rows = ((data ?? []) as unknown[]).map((r: unknown) => {
        const row = r as {
          id: string;
          day_of_week: number;
          departure_time: string | null;
          arrival_time: string | null;
          vehicle_type: string | null;
          is_active: boolean;
          status: string | null;
          worker_routes: { origin_address: string; destination_address: string } | null;
        };
        return {
          id: row.id,
          day_of_week: row.day_of_week,
          departure_time: row.departure_time,
          arrival_time: row.arrival_time,
          vehicle_type: row.vehicle_type,
          is_active: row.is_active,
          status: row.status,
          route_origin: row.worker_routes?.origin_address ?? null,
          route_destination: row.worker_routes?.destination_address ?? null,
        } as TripRow;
      });

      setTrips(rows);
      const states: Record<number, DayState> = {};
      for (const t of rows) {
        if (!states[t.id as unknown as number]) {
          states[t.day_of_week] = {
            vehicleType: (t.vehicle_type ?? 'principal') as 'principal' | 'reserva',
            statusActive: t.is_active,
          };
        }
      }
      setDayStates(states);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = (dayIdx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => (prev === dayIdx ? null : dayIdx));
  };

  const updateTrip = async (tripId: string, dayIdx: number, update: Partial<{ vehicle_type: string; is_active: boolean }>) => {
    setSaving(tripId);
    setDayStates((prev) => ({
      ...prev,
      [dayIdx]: {
        vehicleType: update.vehicle_type ? update.vehicle_type as 'principal' | 'reserva' : prev[dayIdx]?.vehicleType ?? 'principal',
        statusActive: update.is_active !== undefined ? update.is_active : prev[dayIdx]?.statusActive ?? true,
      },
    }));
    await supabase.from('scheduled_trips').update(update as never).eq('id', tripId);
    setSaving(null);
  };

  const dayTrips = (dayIdx: number) =>
    trips.filter((t) => t.day_of_week === dayIdx + 1 || (dayIdx === 6 && t.day_of_week === 0));

  function shortAddr(s: string | null) {
    if (!s) return '—';
    return s.split(',')[0]?.trim() ?? s;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => route.params?.fromHome ? (navigation.getParent() as any)?.navigate('Home') : navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cronograma de viagens</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#111827" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {DAYS.map((day, idx) => {
            const dayT = dayTrips(idx);
            const isOpen = expanded === idx;
            const tripCount = dayT.length;
            const firstTrip = dayT[0];
            const ds = dayStates[idx];

            return (
              <View key={day} style={[styles.card, isOpen && styles.cardOpen]}>
                <TouchableOpacity style={styles.cardHeader} onPress={() => toggle(idx)} activeOpacity={0.7}>
                  <View>
                    <Text style={styles.dayName}>{day}</Text>
                    <Text style={styles.tripCount}>{tripCount} {tripCount === 1 ? 'viagem' : 'viagens'}</Text>
                  </View>
                  <MaterialIcons name={isOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={22} color="#6B7280" />
                </TouchableOpacity>

                {isOpen && firstTrip && (
                  <View style={styles.cardBody}>
                    <View style={styles.divider} />

                    <View style={styles.tripRoute}>
                      <Text style={styles.tripOrigin}>{shortAddr(firstTrip.route_origin)}</Text>
                      <View style={styles.arrowWrap}>
                        <MaterialIcons name="arrow-forward" size={18} color="#C9A227" />
                      </View>
                      <Text style={styles.tripDest}>{shortAddr(firstTrip.route_destination)}</Text>
                    </View>

                    <View style={styles.timesRow}>
                      <Text style={styles.timeText}>{firstTrip.departure_time?.slice(0, 5) ?? '—'}</Text>
                      <Text style={styles.timeText}>{firstTrip.arrival_time?.slice(0, 5) ?? '—'}</Text>
                    </View>

                    <View style={styles.divider} />

                    <Text style={styles.sectionLabel}>Definir tipo de uso do veículo</Text>

                    {(['principal', 'reserva'] as const).map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={styles.radioRow}
                        onPress={() => firstTrip && updateTrip(firstTrip.id, idx, { vehicle_type: opt })}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.radioOuter, (ds?.vehicleType ?? 'principal') === opt && styles.radioActive]}>
                          {(ds?.vehicleType ?? 'principal') === opt && <View style={styles.radioInner} />}
                        </View>
                        <View>
                          <Text style={styles.radioLabel}>{opt === 'principal' ? 'Principal' : 'Reserva'}</Text>
                          <Text style={styles.radioSub}>
                            {opt === 'principal' ? 'Veículo principal utilizado nas corridas.' : 'Usado apenas quando o principal estiver indisponível.'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}

                    <View style={styles.divider} />

                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Status da viagem</Text>
                      <Switch
                        value={ds?.statusActive ?? true}
                        onValueChange={(v) => firstTrip && updateTrip(firstTrip.id, idx, { is_active: v })}
                        trackColor={{ false: '#E5E7EB', true: '#111827' }}
                        thumbColor="#FFFFFF"
                        disabled={saving === firstTrip?.id}
                      />
                    </View>
                  </View>
                )}

                {isOpen && !firstTrip && (
                  <View style={styles.cardBody}>
                    <View style={styles.divider} />
                    <Text style={styles.emptyDay}>Nenhuma viagem neste dia.</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8 + SCREEN_TOP_EXTRA_PADDING, paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  cardOpen: { borderColor: '#111827' },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 18,
  },
  dayName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  tripCount: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  cardBody: { paddingHorizontal: 20, paddingBottom: 18 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 14 },
  tripRoute: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  tripOrigin: { fontSize: 16, fontWeight: '700', color: '#111827' },
  arrowWrap: { paddingHorizontal: 4 },
  tripDest: { fontSize: 16, fontWeight: '700', color: '#111827' },
  timesRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeText: { fontSize: 22, fontWeight: '700', color: '#111827' },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 12 },
  radioRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  radioActive: { borderColor: '#111827' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827' },
  radioLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  radioSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  statusLabel: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
  emptyDay: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 8 },
});
