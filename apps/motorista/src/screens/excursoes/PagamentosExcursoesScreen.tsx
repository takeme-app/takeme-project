import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from '../../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PagamentosExcStackParamList } from '../../navigation/PagamentosExcursoesStack';
import { supabase } from '../../lib/supabase';
import { SCREEN_TOP_EXTRA_PADDING } from '../../theme/screenLayout';

type Props = NativeStackScreenProps<PagamentosExcStackParamList, 'PagamentosMain'>;

const GOLD = '#C9A227';
const CREAM = '#FFFBEB';
const GOLD_BORDER = '#E6C94A';

const PT_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const PT_MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type Transfer = {
  id: string;
  amount_cents: number;
  paid_at: string;
};

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')} ${PT_MONTHS_SHORT[d.getMonth()]}`;
}

function formatHour(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function PixIcon() {
  return (
    <View style={styles.pixIconCircle}>
      <Text style={styles.pixIconDiamond}>◆</Text>
    </View>
  );
}

export function PagamentosExcursoesScreen({ navigation }: Props) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const [totalTodayCents, setTotalTodayCents] = useState(0);
  const [excursionsToday, setExcursionsToday] = useState(0);
  const [tipsCount] = useState(0);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [pixKey, setPixKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editPixVisible, setEditPixVisible] = useState(false);
  const [newPixKey, setNewPixKey] = useState('');
  const [savingPix, setSavingPix] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: wp } = await (supabase as any)
      .from('worker_profiles')
      .select('pix_key')
      .eq('id', user.id)
      .single();
    setPixKey(wp?.pix_key ?? null);

    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

    const { data: todayPayouts } = await (supabase as any)
      .from('payouts')
      .select('id, worker_amount_cents, paid_at')
      .eq('worker_id', user.id)
      .eq('status', 'paid')
      .gte('paid_at', startToday)
      .lte('paid_at', endToday)
      .order('paid_at', { ascending: false });

    const todayList = (todayPayouts ?? []) as { id: string; worker_amount_cents: number; paid_at: string }[];
    setTotalTodayCents(todayList.reduce((s, p) => s + p.worker_amount_cents, 0));
    setExcursionsToday(todayList.length);

    const isCurrentCalendarMonth =
      viewYear === today.getFullYear() && viewMonth === today.getMonth();

    const monthStart = new Date(viewYear, viewMonth, 1).toISOString();
    const monthEnd = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59, 999).toISOString();

    let q = (supabase as any)
      .from('payouts')
      .select('id, worker_amount_cents, paid_at')
      .eq('worker_id', user.id)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false });

    if (isCurrentCalendarMonth) {
      q = q.gte('paid_at', startToday).lte('paid_at', endToday);
    } else {
      q = q.gte('paid_at', monthStart).lte('paid_at', monthEnd);
    }

    const { data: listData } = await q;
    setTransfers(
      ((listData ?? []) as { id: string; worker_amount_cents: number; paid_at: string }[]).map((p) => ({
        id: p.id,
        amount_cents: p.worker_amount_cents,
        paid_at: p.paid_at,
      })),
    );
    setLoading(false);
  }, [viewYear, viewMonth]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSavePix = async () => {
    const key = newPixKey.trim();
    if (!key) return;
    setSavingPix(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await (supabase as any)
        .from('worker_profiles')
        .update({ pix_key: key, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      setPixKey(key);
    }
    setSavingPix(false);
    setEditPixVisible(false);
    setNewPixKey('');
  };

  const today = new Date();
  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const listTitle = isCurrentMonth ? 'Transferências de hoje' : `Transferências em ${PT_MONTHS[viewMonth]}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.headerSide} />
        <Text style={styles.headerTitle}>Pagamentos</Text>
        <View style={styles.headerSide}>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <MaterialIcons name="notifications-none" size={22} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity style={styles.monthArrow} onPress={goPrevMonth} activeOpacity={0.7}>
          <MaterialIcons name="chevron-left" size={26} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{PT_MONTHS[viewMonth]}</Text>
        <TouchableOpacity style={styles.monthArrow} onPress={goNextMonth} activeOpacity={0.7}>
          <MaterialIcons name="chevron-right" size={26} color="#374151" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={GOLD} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Recebido hoje</Text>
            <Text style={styles.summaryAmount}>{formatCents(totalTodayCents)}</Text>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryRowLabel}>Excursões</Text>
              <Text style={styles.summaryRowValue}>{excursionsToday}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryRowLabel}>Gorjetas</Text>
              <Text style={styles.summaryRowValue}>{tipsCount}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.pixCard}
            onPress={() => {
              setNewPixKey(pixKey ?? '');
              setEditPixVisible(true);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.pixCardContent}>
              <Text style={styles.pixCardLabel}>
                {pixKey ? 'Chave Pix cadastrada' : 'Cadastrar chave Pix'}
              </Text>
              {pixKey ? <Text style={styles.pixCardValue}>{pixKey}</Text> : null}
            </View>
            <MaterialIcons name="edit" size={20} color={GOLD} />
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>{listTitle}</Text>

          {transfers.length === 0 ? (
            <Text style={styles.emptyText}>
              {isCurrentMonth ? 'Nenhuma transferência hoje.' : 'Nenhuma transferência neste mês.'}
            </Text>
          ) : (
            <View>
              {transfers.map((t, i) => (
                <View key={t.id}>
                  <View style={styles.transferRow}>
                    <PixIcon />
                    <View style={styles.transferInfo}>
                      <Text style={styles.transferAmount}>{formatCents(t.amount_cents)}</Text>
                      <Text style={styles.transferMeta}>Pix • {formatHour(t.paid_at)}</Text>
                    </View>
                    <Text style={styles.transferDate}>{formatShortDate(t.paid_at)}</Text>
                  </View>
                  {i < transfers.length - 1 ? <View style={styles.sep} /> : null}
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.historyLink}
            onPress={() => navigation.navigate('PagamentosHistorico')}
            activeOpacity={0.7}
          >
            <Text style={styles.historyLinkText}>Ver histórico completo</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal visible={editPixVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior="padding"
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setEditPixVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandleRow}>
              <View style={styles.sheetHandle} />
            </View>
            <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setEditPixVisible(false)}>
              <View style={styles.sheetCloseCircle}>
                <MaterialIcons name="close" size={18} color="#374151" />
              </View>
            </TouchableOpacity>
            <View style={styles.sheetHeaderContent}>
              <Text style={styles.sheetTitle}>Alterar chave Pix</Text>
              <Text style={styles.sheetSubtitle}>
                Atualize sua chave Pix para receber seus pagamentos no novo destino.
                {'\n\n'}
                Você pode editar essa informação sempre que quiser.
              </Text>
            </View>
            <View style={styles.sheetDivider} />
            <View style={styles.sheetBody}>
              <Text style={styles.inputLabel}>Nova chave Pix</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ex: 995431232 ou email@exemplo.com"
                placeholderTextColor="#9CA3AF"
                value={newPixKey}
                onChangeText={setNewPixKey}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.btnPrimary, (!newPixKey.trim() || savingPix) && { opacity: 0.6 }]}
                onPress={handleSavePix}
                disabled={savingPix || !newPixKey.trim()}
                activeOpacity={0.85}
              >
                {savingPix ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Salvar alteração</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setEditPixVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8 + SCREEN_TOP_EXTRA_PADDING,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerSide: { width: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#111827' },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  monthArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: { fontSize: 16, fontWeight: '600', color: '#111827', minWidth: 120, textAlign: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 20 },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryLabel: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 6 },
  summaryAmount: { fontSize: 36, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 16 },
  summaryDivider: { height: 1, backgroundColor: '#E5E7EB', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryRowLabel: { fontSize: 15, color: '#9CA3AF' },
  summaryRowValue: { fontSize: 15, fontWeight: '700', color: '#111827' },

  pixCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CREAM,
    borderWidth: 1.5,
    borderColor: GOLD_BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 28,
  },
  pixCardContent: { flex: 1 },
  pixCardLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  pixCardValue: { fontSize: 16, fontWeight: '600', color: '#111827' },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 16 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginVertical: 12 },

  transferRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  pixIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CREAM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pixIconDiamond: { fontSize: 20, color: GOLD },
  transferInfo: { flex: 1 },
  transferAmount: { fontSize: 16, fontWeight: '700', color: '#111827' },
  transferMeta: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  transferDate: { fontSize: 14, color: '#9CA3AF' },
  sep: { height: 1, backgroundColor: '#F3F4F6' },

  historyLink: { alignItems: 'center', marginTop: 28 },
  historyLinkText: { fontSize: 15, color: '#111827', textDecorationLine: 'underline', fontWeight: '500' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  sheetHandleRow: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' },
  sheetCloseBtn: { position: 'absolute', top: 12, right: 20, zIndex: 1 },
  sheetCloseCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeaderContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20 },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 12 },
  sheetSubtitle: { fontSize: 16, color: '#6B7280', lineHeight: 24 },
  sheetDivider: { height: 1, backgroundColor: '#E5E7EB' },
  sheetBody: { paddingHorizontal: 24, paddingTop: 24, gap: 12 },
  inputLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  textInput: {
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111827',
  },
  btnPrimary: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnPrimaryText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  btnCancel: {
    backgroundColor: '#EFEFEF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnCancelText: { fontSize: 16, fontWeight: '600', color: '#B24A44' },
});
