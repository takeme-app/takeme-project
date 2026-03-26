import { useState, useEffect, useCallback } from 'react';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ColetasEncomendasStackParamList } from '../../navigation/ColetasEncomendasStack';
import { SCREEN_TOP_EXTRA_PADDING } from '../../theme/screenLayout';
import { supabase } from '../../lib/supabase';

type Props = NativeStackScreenProps<ColetasEncomendasStackParamList, 'DetalhesEncomenda'>;

type ShipmentDetail = {
  id: string;
  tripId: string;
  originAddress: string;
  destinationAddress: string;
  packageSize: string;
  amountCents: number;
  instructions: string | null;
  createdAt: string;
  scheduledAt: string | null;
  status: string;
  clientName: string;
};

function tripId(id: string): string {
  return 'VG' + id.replace(/-/g, '').slice(-6).toUpperCase();
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
    }) + ', ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function packageSizeLabel(size: string): string {
  if (size === 'pequeno') return 'Pequeno';
  if (size === 'grande') return 'Grande';
  return 'Médio';
}

const SUPPORT_PHONE = '+5500000000000';
const SUPPORT_WHATSAPP = '+5500000000000';

export function DetalhesEncomendaScreen({ navigation, route }: Props) {
  const { shipmentId } = route.params;
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [supportVisible, setSupportVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('shipments')
      .select('id, origin_address, destination_address, package_size, amount_cents, instructions, created_at, scheduled_at, status, user_id')
      .eq('id', shipmentId)
      .maybeSingle();

    if (!data) { setLoading(false); return; }
    const row = data as {
      id: string; origin_address: string; destination_address: string;
      package_size: string; amount_cents: number; instructions: string | null;
      created_at: string; scheduled_at: string | null; status: string; user_id: string;
    };

    const { data: prof } = await supabase
      .from('profiles').select('full_name').eq('id', row.user_id).maybeSingle();
    const p = prof as { full_name?: string | null } | null;

    setDetail({
      id: row.id,
      tripId: tripId(row.id),
      originAddress: row.origin_address,
      destinationAddress: row.destination_address,
      packageSize: packageSizeLabel(row.package_size),
      amountCents: row.amount_cents,
      instructions: row.instructions,
      createdAt: formatDateTime(row.created_at),
      scheduledAt: row.scheduled_at ? formatDateTime(row.scheduled_at) : null,
      status: row.status,
      clientName: p?.full_name ?? 'Cliente',
    });
    setLoading(false);
  }, [shipmentId]);

  useEffect(() => { load(); }, [load]);

  const handleCall = () => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`);
    setSupportVisible(false);
  };

  const handleWhatsApp = () => {
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP.replace('+', '')}`);
    setSupportVisible(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="close" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes do pedido</Text>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
          <MaterialIcons name="notifications-none" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#111827" style={{ marginTop: 48 }} />
      ) : !detail ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Pedido não encontrado</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Map placeholder */}
          <View style={styles.mapPlaceholder}>
            <MaterialIcons name="map" size={40} color="#C9B87A" />
            <Text style={styles.mapPlaceholderText}>{detail.originAddress}</Text>
          </View>

          <View style={styles.card}>
            {/* Trip ID */}
            <View style={styles.tripIdRow}>
              <Text style={styles.tripIdLabel}>Id da viagem</Text>
              <Text style={styles.tripIdValue}>{detail.tripId}</Text>
            </View>

            {/* Route */}
            <View style={styles.routeRow}>
              <Text style={styles.routeFrom} numberOfLines={1}>{detail.originAddress}</Text>
              <MaterialIcons name="arrow-forward" size={16} color="#C9A227" style={styles.routeArrow} />
              <Text style={styles.routeTo} numberOfLines={1}>{detail.destinationAddress}</Text>
            </View>

            <View style={styles.cardDivider} />

            {/* Timeline */}
            <View style={styles.timeline}>
              <TimelineItem label="Solicitação" date={detail.createdAt} isLast={!detail.scheduledAt} />
              {detail.scheduledAt && (
                <TimelineItem label="Coleta confirmada" date={detail.scheduledAt} isLast={true} />
              )}
            </View>

            <View style={styles.cardDivider} />

            {/* Client */}
            <View style={styles.clientSection}>
              <View style={styles.clientRow}>
                <View style={styles.clientAvatar}>
                  <Text style={styles.clientAvatarInitial}>
                    {detail.clientName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.clientInfo}>
                  <Text style={styles.clientLabel}>Cliente</Text>
                  <Text style={styles.clientName}>{detail.clientName}</Text>
                </View>
              </View>
            </View>

            <View style={styles.cardDivider} />

            {/* Package info */}
            <View style={styles.packageRow}>
              <View style={styles.packageItem}>
                <Text style={styles.packageItemLabel}>Tamanho</Text>
                <Text style={styles.packageItemValue}>{detail.packageSize}</Text>
              </View>
              <View style={styles.packageDivider} />
              <View style={styles.packageItem}>
                <Text style={styles.packageItemLabel}>Valor</Text>
                <Text style={[styles.packageItemValue, { color: '#C9A227' }]}>{formatCents(detail.amountCents)}</Text>
              </View>
            </View>

            {detail.instructions && (
              <>
                <View style={styles.cardDivider} />
                <Text style={styles.obsLabel}>Instruções</Text>
                <Text style={styles.obsText}>{detail.instructions}</Text>
              </>
            )}

            <View style={styles.cardDivider} />

            {/* Support */}
            <TouchableOpacity
              style={styles.supportRow}
              activeOpacity={0.7}
              onPress={() => setSupportVisible(true)}
            >
              <MaterialIcons name="headset-mic" size={18} color="#6B7280" />
              <Text style={styles.supportText}>Mensagens com o cliente</Text>
              <MaterialIcons name="chevron-right" size={18} color="#9CA3AF" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Support modal */}
      <Modal visible={supportVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSupportVisible(false)} />
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setSupportVisible(false)} activeOpacity={0.7}>
            <MaterialIcons name="close" size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.sheetTitle}>Como podemos ajudar?</Text>
          <Text style={styles.sheetSubtitle}>Escolha uma das opções abaixo{'\n'}para entrar em contato</Text>
          <View style={styles.sheetDivider} />
          <TouchableOpacity style={styles.supportOption} onPress={handleCall} activeOpacity={0.85}>
            <View style={styles.supportOptionIcon}>
              <MaterialIcons name="phone" size={24} color="#92400E" />
            </View>
            <Text style={styles.supportOptionText}>Ligar para o suporte Take Me</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.supportOption} onPress={handleWhatsApp} activeOpacity={0.85}>
            <View style={styles.supportOptionIcon}>
              <MaterialIcons name="chat" size={24} color="#92400E" />
            </View>
            <Text style={styles.supportOptionText}>WhatsApp do Take Me</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.supportOption} onPress={() => setSupportVisible(false)} activeOpacity={0.85}>
            <View style={styles.supportOptionIcon}>
              <MaterialIcons name="headset-mic" size={24} color="#92400E" />
            </View>
            <Text style={styles.supportOptionText}>Chat com o suporte Take Me</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function TimelineItem({ label, date, isLast }: { label: string; date: string; isLast: boolean }) {
  return (
    <View style={tlStyles.row}>
      <View style={tlStyles.dotCol}>
        <View style={tlStyles.dot} />
        {!isLast && <View style={tlStyles.line} />}
      </View>
      <View style={tlStyles.content}>
        <Text style={tlStyles.label}>{label}</Text>
        <Text style={tlStyles.date}>{date}</Text>
      </View>
    </View>
  );
}

const tlStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  dotCol: { alignItems: 'center', width: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#9CA3AF', marginTop: 4 },
  line: { flex: 1, width: 2, backgroundColor: '#E5E7EB', minHeight: 24, marginTop: 4 },
  content: { flex: 1, paddingBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  date: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12 + SCREEN_TOP_EXTRA_PADDING,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  scroll: { paddingBottom: 40 },
  mapPlaceholder: {
    height: 180, backgroundColor: '#F0EDE8',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  mapPlaceholderText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  card: {
    marginHorizontal: 20, marginTop: 16,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20, overflow: 'hidden',
  },
  tripIdRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  tripIdLabel: { fontSize: 13, color: '#9CA3AF' },
  tripIdValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  routeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  routeFrom: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  routeArrow: { marginHorizontal: 8 },
  routeTo: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1, textAlign: 'right' },
  cardDivider: { height: 1, backgroundColor: '#F3F4F6' },
  timeline: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  clientSection: { paddingHorizontal: 16, paddingVertical: 16 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center',
  },
  clientAvatarInitial: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  clientInfo: { flex: 1 },
  clientLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  clientName: { fontSize: 17, fontWeight: '700', color: '#111827' },
  packageRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16,
  },
  packageItem: { flex: 1, alignItems: 'center', gap: 4 },
  packageItemLabel: { fontSize: 12, color: '#9CA3AF' },
  packageItemValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  packageDivider: { width: 1, backgroundColor: '#E5E7EB' },
  obsLabel: { fontSize: 13, fontWeight: '600', color: '#374151', paddingHorizontal: 16, paddingTop: 14, marginBottom: 4 },
  obsText: { fontSize: 14, color: '#6B7280', paddingHorizontal: 16, paddingBottom: 14, lineHeight: 20 },
  supportRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 16,
  },
  supportText: { fontSize: 14, color: '#6B7280' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, color: '#9CA3AF' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingBottom: 48, paddingTop: 24,
  },
  sheetCloseBtn: {
    alignSelf: 'flex-end', width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  sheetTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 },
  sheetSubtitle: { fontSize: 14, color: '#9CA3AF', lineHeight: 22, marginBottom: 20 },
  sheetDivider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 20 },
  supportOption: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#FFFBEB', borderRadius: 16,
    paddingVertical: 18, paddingHorizontal: 16, marginBottom: 12,
  },
  supportOptionIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center',
  },
  supportOptionText: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
});
