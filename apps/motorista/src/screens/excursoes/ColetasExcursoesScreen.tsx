import { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ColetasExcursoesStackParamList } from '../../navigation/ColetasExcursoesStack';
import { SCREEN_TOP_EXTRA_PADDING } from '../../theme/screenLayout';
import { supabase } from '../../lib/supabase';

type Props = NativeStackScreenProps<ColetasExcursoesStackParamList, 'ColetasMain'>;

type Excursion = {
  id: string;
  origin: string;
  destination: string;
  departureTime: string | null;
  returnTime: string | null;
  passengerCount: number;
  transportType: string;
  responsible: string;
  direction: string;
  status: string;
  expanded: boolean;
};

type StatusConfig = { label: string; bg: string; text: string; border: string };

const STATUS_MAP: Record<string, StatusConfig> = {
  contacted:       { label: 'Em andamento',       bg: '#FEF3C7', text: '#92400E', border: '#C9A227' },
  in_progress:     { label: 'Em andamento',       bg: '#FEF3C7', text: '#92400E', border: '#C9A227' },
  active:          { label: 'Em andamento',       bg: '#FEF3C7', text: '#92400E', border: '#C9A227' },
  payment_done:    { label: 'Pagamento realizado', bg: '#DBEAFE', text: '#1E40AF', border: '#E5E7EB' },
  paid:            { label: 'Pagamento realizado', bg: '#DBEAFE', text: '#1E40AF', border: '#E5E7EB' },
  pending_rating:  { label: 'Avaliação Pendente', bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
  confirmed:       { label: 'Concluído',          bg: '#D1FAE5', text: '#065F46', border: '#E5E7EB' },
  completed:       { label: 'Concluído',          bg: '#D1FAE5', text: '#065F46', border: '#E5E7EB' },
  cancelled:       { label: 'Cancelado',          bg: '#FEE2E2', text: '#991B1B', border: '#E5E7EB' },
};

const DEFAULT_STATUS: StatusConfig = { label: 'Pendente', bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' };

function statusCfg(status: string): StatusConfig {
  return STATUS_MAP[status] ?? DEFAULT_STATUS;
}

function formatDateLabel(iso: string | null, direction: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const day = d.getDate().toString().padStart(2, '0');
    const mon = months[d.getMonth()] ?? '';
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${day} ${mon} • ${time} (${direction})`;
  } catch { return '—'; }
}

export function ColetasExcursoesScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [excursions, setExcursions] = useState<Excursion[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) { setLoading(false); return; }

    const { data } = await supabase
      .from('excursion_requests')
      .select(
        'id, origin, destination, excursion_date, departure_time, return_time, return_date, people_count, transport_type, responsible_name, direction, status, user_id, created_at',
      )
      .eq('preparer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const rows = (data ?? []) as any[];
    const list: Excursion[] = [];

    for (const r of rows) {
      // responsible: use responsible_name column or fall back to client profile
      let responsible = r.responsible_name ?? null;
      if (!responsible) {
        const { data: prof } = await supabase
          .from('profiles').select('full_name').eq('id', r.user_id).maybeSingle();
        responsible = (prof as any)?.full_name ?? 'Cliente';
      }

      const depIso = r.departure_time ?? r.excursion_date ?? null;
      const retIso = r.return_time ?? r.return_date ?? null;

      list.push({
        id: r.id,
        origin: r.origin ?? 'Origem',
        destination: r.destination ?? 'Destino',
        departureTime: depIso,
        returnTime: retIso,
        passengerCount: r.people_count ?? 0,
        transportType: r.transport_type ?? 'Van',
        responsible,
        direction: r.direction ?? 'Ida',
        status: r.status ?? 'pending',
        expanded: true,
      });
    }

    setExcursions(list);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleExpand = useCallback((id: string) => {
    setExcursions((prev) => prev.map((e) => e.id === id ? { ...e, expanded: !e.expanded } : e));
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.canGoBack() ? navigation.goBack() : undefined} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Excursões</Text>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
          <MaterialIcons name="notifications-none" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#111827" style={{ marginTop: 48 }} />
      ) : excursions.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="directions-bus" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>Nenhuma excursão ainda</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {excursions.map((exc) => {
            const cfg = statusCfg(exc.status);
            return (
              <View key={exc.id} style={[styles.card, { borderColor: cfg.border }]}>
                {/* Status row */}
                <TouchableOpacity
                  style={styles.cardTopRow}
                  onPress={() => toggleExpand(exc.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
                  </View>
                  <MaterialIcons
                    name={exc.expanded ? 'expand-less' : 'expand-more'}
                    size={22}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>

                {/* Route */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('DetalhesExcursao', { excursionId: exc.id })}
                >
                  <View style={styles.routeRow}>
                    <Text style={styles.routeCity}>{exc.origin}</Text>
                    <MaterialIcons name="arrow-forward" size={16} color="#374151" style={{ marginHorizontal: 8 }} />
                    <Text style={[styles.routeCity, { textAlign: 'right', flex: 1 }]}>{exc.destination}</Text>
                  </View>
                  <View style={styles.datesRow}>
                    <Text style={styles.dateLabel}>{formatDateLabel(exc.departureTime, 'ida')}</Text>
                    {exc.returnTime ? (
                      <>
                        <Text style={styles.dateSep}> | </Text>
                        <Text style={styles.dateLabel}>{formatDateLabel(exc.returnTime, 'retorno')}</Text>
                      </>
                    ) : null}
                  </View>

                  {exc.expanded && (
                    <View style={styles.detailsSection}>
                      <DetailRow label="Passageiros" value={`${exc.passengerCount} passageiros`} />
                      <DetailRow label="Tipo de transporte" value={exc.transportType} />
                      <DetailRow label="Responsável" value={exc.responsible} />
                      <DetailRow label="Navegação" value={exc.direction} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8 + SCREEN_TOP_EXTRA_PADDING,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },

  // Cards
  card: {
    borderWidth: 1.5, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 16, backgroundColor: '#FFFFFF',
  },
  cardTopRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusPill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  statusText: { fontSize: 13, fontWeight: '700' },

  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  routeCity: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },

  datesRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
  dateLabel: { fontSize: 13, color: '#6B7280' },
  dateSep: { fontSize: 13, color: '#D1D5DB' },

  detailsSection: { gap: 8, paddingTop: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailLabel: { fontSize: 14, color: '#9CA3AF' },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '500', textAlign: 'right' },
});
