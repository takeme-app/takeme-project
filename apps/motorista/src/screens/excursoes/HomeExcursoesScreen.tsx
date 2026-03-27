import { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Modal,
} from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { SCREEN_TOP_EXTRA_PADDING } from '../../theme/screenLayout';

type GroupSize = 'Pequeno' | 'Médio' | 'Grande';

type Solicitacao = {
  id: string;
  clientName: string;
  clientInitial: string;
  size: GroupSize;
  priceFormatted: string;
  baseLocation: string;
  time: string;
  observations: string;
  expanded: boolean;
};

const SIZE_COLORS: Record<GroupSize, { bg: string; text: string }> = {
  Pequeno: { bg: '#D1FAE5', text: '#065F46' },
  Médio:   { bg: '#DBEAFE', text: '#1E40AF' },
  Grande:  { bg: '#FEE2E2', text: '#991B1B' },
};

const MOCK: Solicitacao[] = [
  {
    id: '1',
    clientName: 'Carlos Mendes',
    clientInitial: 'C',
    size: 'Médio',
    priceFormatted: 'R$ 2.400,00',
    baseLocation: 'Terminal Rodoviário, Campina Grande',
    time: '14:30',
    observations: 'Grupo de 25 pessoas, excursão para Recife. Necessário transporte com ar-condicionado.',
    expanded: false,
  },
  {
    id: '2',
    clientName: 'Ana Lima',
    clientInitial: 'A',
    size: 'Pequeno',
    priceFormatted: 'R$ 1.100,00',
    baseLocation: 'Praça da Bandeira, João Pessoa',
    time: '09:00',
    observations: 'Grupo de 12 pessoas. Excursão familiar para Serra da Cangalha.',
    expanded: false,
  },
  {
    id: '3',
    clientName: 'Roberto Souza',
    clientInitial: 'R',
    size: 'Grande',
    priceFormatted: 'R$ 5.800,00',
    baseLocation: 'Shopping Mangabeira, João Pessoa',
    time: '07:00',
    observations: 'Grupo de 50 pessoas. Excursão de empresa para Natal. Data fixa.',
    expanded: false,
  },
];

export function HomeExcursoesScreen() {
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>(MOCK);
  const [acceptModal, setAcceptModal] = useState<Solicitacao | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);

  const toggleExpand = useCallback((id: string) => {
    setSolicitacoes((prev) => prev.map((s) => (s.id === id ? { ...s, expanded: !s.expanded } : s)));
  }, []);

  const confirmAccept = useCallback(() => {
    if (!acceptModal) return;
    setAccepted((prev) => [...prev, acceptModal.id]);
    setAcceptModal(null);
  }, [acceptModal]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Text style={styles.greeting}>Olá, Preparador!</Text>
        <Text style={styles.subGreeting}>Veja as solicitações disponíveis hoje.</Text>

        <Text style={styles.sectionTitle}>Ações necessárias</Text>
        <View style={styles.actionCard}>
          <View style={styles.actionRow}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: gpsEnabled ? '#D1FAE5' : '#F3F4F6' }]}>
                <MaterialIcons name="gps-fixed" size={20} color={gpsEnabled ? '#065F46' : '#6B7280'} />
              </View>
              <View>
                <Text style={styles.actionLabel}>GPS</Text>
                <Text style={styles.actionDesc}>{gpsEnabled ? 'Localização ativa' : 'Ativar localização'}</Text>
              </View>
            </View>
            <Switch value={gpsEnabled} onValueChange={setGpsEnabled} trackColor={{ false: '#E5E7EB', true: '#111827' }} thumbColor="#FFFFFF" />
          </View>
          <View style={styles.sep} />
          <View style={styles.actionRow}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: notifEnabled ? '#D1FAE5' : '#F3F4F6' }]}>
                <MaterialIcons name="notifications" size={20} color={notifEnabled ? '#065F46' : '#6B7280'} />
              </View>
              <View>
                <Text style={styles.actionLabel}>Notificações</Text>
                <Text style={styles.actionDesc}>{notifEnabled ? 'Ativadas' : 'Ativar notificações'}</Text>
              </View>
            </View>
            <Switch value={notifEnabled} onValueChange={setNotifEnabled} trackColor={{ false: '#E5E7EB', true: '#111827' }} thumbColor="#FFFFFF" />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Solicitações de excursão</Text>
        {solicitacoes.map((s) => {
          const isAccepted = accepted.includes(s.id);
          const c = SIZE_COLORS[s.size];
          return (
            <View key={s.id} style={[styles.card, isAccepted && styles.cardAccepted]}>
              <View style={styles.cardTop}>
                <View style={styles.clientRow}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{s.clientInitial}</Text></View>
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName}>{s.clientName}</Text>
                    <Text style={styles.cardTime}>{s.time}</Text>
                  </View>
                </View>
                <View style={[styles.sizeBadge, { backgroundColor: c.bg }]}>
                  <Text style={[styles.sizeBadgeText, { color: c.text }]}>{s.size}</Text>
                </View>
              </View>
              <Text style={styles.price}>{s.priceFormatted}</Text>
              <View style={styles.locationRow}>
                <MaterialIcons name="place" size={14} color="#9CA3AF" />
                <Text style={styles.locationText} numberOfLines={1}>{s.baseLocation}</Text>
              </View>
              <TouchableOpacity style={styles.expandBtn} onPress={() => toggleExpand(s.id)} activeOpacity={0.7}>
                <Text style={styles.expandBtnText}>{s.expanded ? 'Ver menos' : 'Ver detalhes'}</Text>
                <MaterialIcons name={s.expanded ? 'expand-less' : 'expand-more'} size={18} color="#6B7280" />
              </TouchableOpacity>
              {s.expanded && (
                <View style={styles.expandedContent}>
                  <View style={styles.sep} />
                  <Text style={styles.obsLabel}>Observações</Text>
                  <Text style={styles.obsText}>{s.observations}</Text>
                </View>
              )}
              {isAccepted ? (
                <View style={styles.acceptedBadge}>
                  <MaterialIcons name="check-circle" size={16} color="#065F46" />
                  <Text style={styles.acceptedText}>Aceito</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.acceptBtn} onPress={() => setAcceptModal(s)} activeOpacity={0.85}>
                  <Text style={styles.acceptBtnText}>Aceitar viagem</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!acceptModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Aceitar viagem?</Text>
            <Text style={styles.modalDesc}>Confirma a solicitação de {acceptModal?.clientName}?</Text>
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setAcceptModal(null)} activeOpacity={0.8}>
                <Text style={styles.modalBtnCancelText}>Não, voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirm} onPress={confirmAccept} activeOpacity={0.85}>
                <Text style={styles.modalBtnConfirmText}>Sim, aceitar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12 + SCREEN_TOP_EXTRA_PADDING },
  greeting: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 4 },
  subGreeting: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 12 },
  actionCard: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4, backgroundColor: '#FAFAFA' },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  actionDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  sep: { height: 1, backgroundColor: '#F3F4F6' },
  card: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 16, padding: 16, marginBottom: 14 },
  cardAccepted: { borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardTime: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  sizeBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  sizeBadgeText: { fontSize: 12, fontWeight: '700' },
  price: { fontSize: 20, fontWeight: '700', color: '#C9A227', marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  locationText: { fontSize: 13, color: '#6B7280', flex: 1 },
  expandBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  expandBtnText: { fontSize: 13, color: '#6B7280' },
  expandedContent: { marginTop: 8 },
  obsLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 4 },
  obsText: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  acceptBtn: { backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  acceptBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  acceptedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 12, backgroundColor: '#D1FAE5', borderRadius: 12 },
  acceptedText: { fontSize: 14, fontWeight: '600', color: '#065F46' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 10 },
  modalDesc: { fontSize: 15, color: '#6B7280', lineHeight: 22, marginBottom: 24 },
  modalRow: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: { flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalBtnCancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  modalBtnConfirm: { flex: 1, backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalBtnConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
