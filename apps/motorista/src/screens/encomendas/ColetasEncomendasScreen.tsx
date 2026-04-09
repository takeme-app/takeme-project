import { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ColetasEncomendasStackParamList } from '../../navigation/ColetasEncomendasStack';
import { SCREEN_TOP_EXTRA_PADDING } from '../../theme/screenLayout';
import { supabase } from '../../lib/supabase';
import { fetchWorkerShipmentBaseId } from '../../lib/preparerEncomendasBase';

type Props = NativeStackScreenProps<ColetasEncomendasStackParamList, 'ColetasMain'>;

type ActiveShipment = {
  id: string;
  shortId: string;
  clientName: string;
  originAddress: string;
  /** Endereço da base (devolução da encomenda). */
  baseAddress: string;
  scheduledAt: string;
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

function formatScheduledAt(iso: string | null, createdAt: string): string {
  const src = iso ?? createdAt;
  try {
    return new Date(src).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

export function ColetasEncomendasScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ActiveShipment | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [supportVisible, setSupportVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) { setLoading(false); return; }

    const myBaseId = await fetchWorkerShipmentBaseId(user.id);
    if (!myBaseId) {
      setActive(null);
      setHistory([]);
      setLoading(false);
      return;
    }

    // Encomenda ativa (confirmada, mesma base do preparador)
    const { data: activeData } = await supabase
      .from('shipments')
      .select('id, origin_address, scheduled_at, created_at, user_id, base_id, bases(name, address)')
      .in('status', ['confirmed', 'in_progress'])
      .eq('driver_id' as never, user.id)
      .eq('base_id' as never, myBaseId as never)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeData) {
      const row = activeData as {
        id: string;
        origin_address: string;
        scheduled_at: string | null;
        created_at: string;
        user_id: string;
        bases?: { name?: string | null; address?: string | null } | null;
      };
      const { data: prof } = await supabase
        .from('profiles').select('full_name').eq('id', row.user_id).maybeSingle();
      const p = prof as { full_name?: string | null } | null;
      const baseAddr = row.bases?.address?.trim()
        ? `${row.bases?.name ? `${row.bases.name} — ` : ''}${row.bases.address}`.trim()
        : 'Base (endereço indisponível)';
      setActive({
        id: row.id,
        shortId: shortId(row.id),
        clientName: p?.full_name ?? 'Cliente',
        originAddress: row.origin_address,
        baseAddress: baseAddr,
        scheduledAt: formatScheduledAt(row.scheduled_at, row.created_at),
      });
    } else {
      setActive(null);
    }

    // Histórico recente (últimas 4, excluindo a ativa)
    const { data: histData } = await supabase
      .from('shipments')
      .select('id, created_at, user_id')
      .eq('driver_id' as never, user.id)
      .eq('base_id' as never, myBaseId as never)
      .order('created_at', { ascending: false })
      .limit(5);

    const rows = (histData ?? []) as { id: string; created_at: string; user_id: string }[];
    const activeId = activeData ? (activeData as { id: string }).id : null;
    const items: HistoryItem[] = [];
    for (const r of rows) {
      if (r.id === activeId) continue;
      if (items.length >= 4) break;
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

  const handleCall = () => {
    Linking.openURL('tel:+5500000000000');
    setSupportVisible(false);
  };

  const handleWhatsApp = () => {
    Linking.openURL('https://wa.me/5500000000000');
    setSupportVisible(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Coletas</Text>
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
              onPress={() => navigation.navigate('ActiveShipment', { shipmentId: active.id })}
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
                <Text style={styles.activeRouteFrom} numberOfLines={1}>{active.originAddress}</Text>
                <MaterialIcons name="arrow-forward" size={14} color="#6B7280" style={{ marginHorizontal: 6 }} />
                <Text style={styles.activeRouteTo} numberOfLines={1}>{active.baseAddress}</Text>
              </View>
              <View style={styles.activeTimeRow}>
                <MaterialIcons name="access-time" size={14} color="#6B7280" />
                <Text style={styles.activeTimeText}>{active.scheduledAt}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>Nenhuma coleta em andamento</Text>
            </View>
          )}

          {/* Histórico */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Histórico</Text>
            <TouchableOpacity
              style={styles.filterBtn}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('HistoricoEncomendas')}
            >
              <MaterialIcons name="tune" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          <View style={styles.listCard}>
            {history.length === 0 ? (
              <View style={styles.emptyHistory}>
                <MaterialIcons name="history" size={32} color="#D1D5DB" />
                <Text style={styles.emptyListText}>Sem histórico ainda</Text>
              </View>
            ) : (
              history.map((item, idx) => (
                <View key={item.id}>
                  <TouchableOpacity
                    style={styles.historyRow}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('DetalhesEncomenda', { shipmentId: item.id })}
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
                  onPress={() => navigation.navigate('HistoricoEncomendas')}
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
              onPress={() => navigation.getParent()?.navigate('ChatEnc')}
            >
              <Text style={styles.verMaisText}>Ver mais</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      )}

      {/* FAB suporte */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => setSupportVisible(true)}
      >
        <MaterialIcons name="headset-mic" size={20} color="#92400E" />
      </TouchableOpacity>

      {/* Modal suporte — card centralizado */}
      <Modal visible={supportVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSupportVisible(false)} />
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSupportVisible(false)} activeOpacity={0.7}>
              <MaterialIcons name="close" size={20} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Como podemos{'\n'}ajudar?</Text>
            <Text style={styles.modalSubtitle}>Escolha uma das opções abaixo para entrar em contato</Text>
            <TouchableOpacity style={styles.supportOption} onPress={handleCall} activeOpacity={0.85}>
              <View style={styles.supportOptionIcon}>
                <MaterialIcons name="phone" size={22} color="#92400E" />
              </View>
              <Text style={styles.supportOptionText}>Ligar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.supportOption} onPress={() => setSupportVisible(false)} activeOpacity={0.85}>
              <View style={styles.supportOptionIcon}>
                <MaterialIcons name="chat-bubble-outline" size={22} color="#92400E" />
              </View>
              <Text style={styles.supportOptionText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.supportOption} onPress={handleWhatsApp} activeOpacity={0.85}>
              <View style={styles.supportOptionIcon}>
                <MaterialIcons name="chat" size={22} color="#92400E" />
              </View>
              <Text style={styles.supportOptionText}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 12 + SCREEN_TOP_EXTRA_PADDING,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 20 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
  filterBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  activeCard: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16,
    padding: 16, marginBottom: 28,
  },
  activeCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  activeCardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  activeStatusBadge: { backgroundColor: '#D1FAE5', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  activeStatusText: { fontSize: 12, fontWeight: '700', color: '#065F46' },
  activeRouteRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  activeRouteFrom: { fontSize: 13, fontWeight: '600', color: '#111827', flex: 1 },
  activeRouteTo: { fontSize: 13, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'right' },
  activeTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeTimeText: { fontSize: 13, color: '#6B7280' },
  emptyCard: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16,
    padding: 20, alignItems: 'center', marginBottom: 28,
  },
  emptyCardText: { fontSize: 14, color: '#9CA3AF' },
  listCard: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  historyInfo: { flex: 1 },
  historyName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  historyDate: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  sep: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },
  verMaisBtn: { paddingVertical: 14, alignItems: 'center' },
  verMaisText: { fontSize: 14, fontWeight: '600', color: '#374151', textDecorationLine: 'underline' },
  chatEmptyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  emptyListText: { fontSize: 14, color: '#9CA3AF' },
  emptyHistory: { paddingVertical: 28, alignItems: 'center', gap: 10 },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  // Support modal — centered card
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    width: '88%', backgroundColor: '#FFFFFF',
    borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6, lineHeight: 30 },
  modalSubtitle: { fontSize: 13, color: '#9CA3AF', lineHeight: 20, marginBottom: 20 },
  supportOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFBEB', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 14, marginBottom: 10,
  },
  supportOptionIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center',
  },
  supportOptionText: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1 },
});
