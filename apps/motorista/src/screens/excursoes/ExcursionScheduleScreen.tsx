import { useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/types';
import { SCREEN_TOP_EXTRA_PADDING } from '../../theme/screenLayout';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ExcursionSchedule'>;

type Row = {
  id: string;
  origin: string;
  destination: string;
  whenLabel: string;
  status: string;
  statusLabel: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  in_analysis: 'Em análise',
  quoted: 'Orçamento',
  approved: 'Aprovada',
  scheduled: 'Agendada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  contacted: 'Em contato',
};

function formatWhen(departureTime: string | null, excursionDate: string | null): string {
  const iso = departureTime ?? excursionDate;
  if (!iso) return 'Data a definir';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function ExcursionScheduleScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('excursion_requests')
      .select('id, destination, scheduled_departure_at, excursion_date, status')
      .eq('preparer_id', user.id)
      .limit(120);

    const raw = (data ?? []) as any[];
    raw.sort((a, b) => {
      const ta = new Date(a.scheduled_departure_at ?? a.excursion_date ?? 0).getTime();
      const tb = new Date(b.scheduled_departure_at ?? b.excursion_date ?? 0).getTime();
      if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return ta - tb;
    });

    const list: Row[] = raw.map((r) => ({
      id: r.id,
      origin: 'Partida',
      destination: r.destination ?? 'Destino',
      whenLabel: formatWhen(r.scheduled_departure_at, r.excursion_date),
      status: r.status ?? 'pending',
      statusLabel: STATUS_LABEL[r.status ?? 'pending'] ?? r.status ?? '—',
    }));

    setRows(list);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cronograma de excursões</Text>
        <View style={styles.iconSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#111827" style={{ marginTop: 48 }} />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="event-busy" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>Nenhuma excursão no cronograma</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {rows.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.when}>{r.whenLabel}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{r.statusLabel}</Text>
                </View>
              </View>
              <Text style={styles.route}>
                {r.origin} → {r.destination}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8 + SCREEN_TOP_EXTRA_PADDING,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSpacer: { width: 40 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#111827' },
  scroll: { padding: 20, paddingBottom: 32 },
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  when: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  badge: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  route: { fontSize: 15, color: '#374151', lineHeight: 22 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },
});
