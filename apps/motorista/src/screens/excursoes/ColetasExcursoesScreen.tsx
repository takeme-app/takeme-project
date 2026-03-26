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

type ActiveExcursion = {
  id: string;
  shortId: string;
  clientName: string;
  destination: string;
  excursionDate: string;
};

type HistoryItem = {
  id: string;
  clientName: string;
  dateLabel: string;
};

function shortId(id: string): string {
  return id.replace(/-/g, '').slice(-4).toUpperCase();
}

function formatHistoryDate(iso: string): string {
  try {
    const d = new Date(iso);
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const month = months[d.getMonth()] ?? '';
    const day = d.getDate().toString().padStart(2, '0');
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${day} ${month}, ${time}`;
  } catch { return iso; }
}

function formatExcursionDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
}

export function ColetasExcursoesScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ActiveExcursion | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) { setLoading(false); return; }

    // Excursão ativa (status contacted = aceita mas não concluída)
    const { data: activeData } = await supabase
      .from('excursion_requests')
      .select('id, destination, excursion_date, user_id')
      .eq('preparer_id', user.id)
      .eq('status', 'contacted')
      .order('excursion_date', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (activeData) {
      const row = activeData as { id: string; destination: string; excursion_date: string; user_id: string };
      const { data: prof } = await supabase
        .from('profiles').select('full_name').eq('id', row.user_id).maybeSingle();
      const p = prof as { full_name?: string | null } | null;
      setActive({
        id: row.id,
        shortId: shortId(row.id),
        clientName: p?.full_name ?? 'Cliente',
        destination: row.destination,
        excursionDate: formatExcursionDate(row.excursion_date),
      });
    } else {
      setActive(null);
    }

    // Histórico recente (últimas 4 excursões concluídas/canceladas)
    const { data: histData } = await supabase
      .from('excursion_requests')
      .select('id, excursion_date, user_id, created_at')
      .eq('preparer_id', user.id)
      .in('status', ['confirmed', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(4);

    const rows = (histData ?? []) as { id: string; excursion_date: string; user_id: string; created_at: string }[];
    const items: HistoryItem[] = [];
    for (const r of rows) {
      const { data: prof } = await supabase
        .from('profiles').select('full_name').eq('id', r.user_id).maybeSingle();
      const p = prof as { full_name?: string | null } | null;
      items.push({
        id: r.id,
        clientName: p?.full_name ?? 'Cliente',
        dateLabel: formatHistoryDate(r.created_at),
      });
    }
    setHistory(items);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Coletas</Text>
        <TouchableOpacity style={styles.bellButton} activeOpacity={0.7}>
          <MaterialIcons name="notifications-none" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#111827" style={{ marginTop: 48 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Em rota */}
          <Text style={styles.sectionTitle}>Em rota</Text>
          {active ? (
            <TouchableOpacity
              style={styles.activeCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('DetalhesExcursao', { excursionId: active.id })}
            >
              <View style={styles.activeCardTop}>
                <Text style={styles.activeCardTitle} numberOfLines={1}>
                  Pedido #{active.shortId} — {active.clientName}
                </Text>
                <View style={styles.activeStatusBadge}>
                  <Text style={styles.activeStatusText}>Em coleta</Text>
                </View>
              </View>
              <View style={styles.activeRouteRow}>
                <Text style={styles.activeRouteText} numberOfLines={1}>{active.destination}</Text>
              </View>
              <View style={styles.activeTimeRow}>
                <MaterialIcons name="access-time" size={14} color="#6B7280" />
                <Text style={styles.activeTimeText}>{active.excursionDate}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>Nenhuma excursão em andamento</Text>
            </View>
          )}

          {/* Histórico */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Histórico</Text>
            <TouchableOpacity
              style={styles.filterBtn}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('HistoricoExcursoes')}
            >
              <MaterialIcons name="tune" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          <View style={styles.listCard}>
            {history.length === 0 ? (
              <Text style={styles.emptyListText}>Sem histórico ainda</Text>
            ) : (
              history.map((item, idx) => (
                <View key={item.id}>
                  <TouchableOpacity
                    style={styles.historyRow}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('DetalhesExcursao', { excursionId: item.id })}
                  >
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyName}>{item.clientName}</Text>
                      <Text style={styles.historyDate}>{item.dateLabel}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                  {idx < history.length - 1 && <View style={styles.sep} />}
                </View>
              ))
            )}
            {history.length > 0 && (
              <>
                <View style={styles.sep} />
                <TouchableOpacity
                  style={styles.verMaisBtn}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('HistoricoExcursoes')}
                >
                  <Text style={styles.verMaisText}>Ver mais</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Chat */}
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Chat</Text>
          <View style={styles.listCard}>
            <View style={styles.chatEmptyRow}>
              <MaterialIcons name="chat-bubble-outline" size={28} color="#D1D5DB" />
              <Text style={styles.emptyListText}>Nenhuma conversa recente</Text>
            </View>
            <View style={styles.sep} />
            <TouchableOpacity
              style={styles.verMaisBtn}
              activeOpacity={0.7}
              onPress={() => navigation.getParent()?.navigate('ChatExc')}
            >
              <Text style={styles.verMaisText}>Ver mais</Text>
            </TouchableOpacity>
          </View>

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
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 12 + SCREEN_TOP_EXTRA_PADDING,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center' },
  bellButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 20 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
  filterBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  // Active card
  activeCard: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16,
    padding: 16, marginBottom: 28, backgroundColor: '#FFFFFF',
  },
  activeCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  activeCardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  activeStatusBadge: {
    backgroundColor: '#D1FAE5', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  activeStatusText: { fontSize: 12, fontWeight: '700', color: '#065F46' },
  activeRouteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  activeRouteText: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  activeTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeTimeText: { fontSize: 13, color: '#6B7280' },
  emptyCard: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16,
    padding: 20, alignItems: 'center', marginBottom: 28,
  },
  emptyCardText: { fontSize: 14, color: '#9CA3AF' },
  // List card
  listCard: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16,
    overflow: 'hidden', marginBottom: 24,
  },
  historyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
  },
  historyInfo: { flex: 1 },
  historyName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  historyDate: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  sep: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },
  verMaisBtn: { paddingVertical: 14, alignItems: 'center' },
  verMaisText: { fontSize: 14, fontWeight: '600', color: '#374151', textDecorationLine: 'underline' },
  chatEmptyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  emptyListText: { fontSize: 14, color: '#9CA3AF' },
});
