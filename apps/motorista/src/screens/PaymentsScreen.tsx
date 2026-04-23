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
  Alert,
  Linking,
} from 'react-native';
import { Text } from '../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { fetchDriverPaymentTransfers, type DriverPaymentTransfer } from '../lib/driverPaymentTransfers';
import { SCREEN_TOP_EXTRA_PADDING } from '../theme/screenLayout';
import { describeInvokeFailure } from '../utils/edgeFunctionResponse';
import { getStripeConnectState, type StripeConnectState } from '../lib/motoristaAccess';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Payments'>,
  NativeStackScreenProps<RootStackParamList>
>;

const GOLD = '#C9A227';
const CREAM = '#FFFBEB';
const GOLD_BORDER = '#E6C94A';

type Transfer = DriverPaymentTransfer;

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]}`;
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

export function PaymentsScreen({ navigation }: Props) {
  const [totalCents, setTotalCents] = useState(0);
  const [rides, setRides] = useState(0);
  const [tips] = useState(0);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [pixKey, setPixKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editPixVisible, setEditPixVisible] = useState(false);
  const [newPixKey, setNewPixKey] = useState('');
  const [savingPix, setSavingPix] = useState(false);
  const [stripeState, setStripeState] = useState<StripeConnectState>('none');
  const [stripePendingVerification, setStripePendingVerification] = useState(0);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [expressLoginLoading, setExpressLoginLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Sync best-effort com a Stripe antes de ler do banco, para não ficar dependendo
    // só do webhook `account.updated`. Se a função falhar, seguimos com o que temos.
    await supabase.functions.invoke('stripe-connect-sync', { body: {} }).catch(() => undefined);

    const { data: wp } = await supabase
      .from('worker_profiles')
      .select(
        'pix_key, stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_details_submitted, stripe_connect_requirements_due_count, stripe_connect_pending_verification_count'
      )
      .eq('id', user.id)
      .single();
    setPixKey(wp?.pix_key ?? null);
    setStripeState(getStripeConnectState(wp));
    setStripePendingVerification(Number(wp?.stripe_connect_pending_verification_count ?? 0) || 0);
    const acct = (wp?.stripe_connect_account_id as string | null | undefined)?.trim() ?? '';
    setStripeAccountId(acct || null);

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

    const list = await fetchDriverPaymentTransfers(supabase, user.id, start, end);

    setTransfers(list);
    setRides(list.length);
    setTotalCents(list.reduce((s, t) => s + t.amount_cents, 0));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSavePix = async () => {
    const key = newPixKey.trim();
    if (!key) return;
    setSavingPix(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('worker_profiles')
        .update({ pix_key: key, updated_at: new Date().toISOString() } as never)
        .eq('id', user.id);
      setPixKey(key);
    }
    setSavingPix(false);
    setEditPixVisible(false);
    setNewPixKey('');
  };

  const handleStripeConnectSetup = async () => {
    setConnectLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        Alert.alert('Erro', 'Sessão expirada. Faça login novamente.');
        setConnectLoading(false);
        return;
      }
      const res = await supabase.functions.invoke('stripe-connect-link', {
        body: {
          return_url: 'take-me-motorista://payments',
          refresh_url: 'take-me-motorista://payments',
          link_type:
            stripeState === 'action_required' || stripeState === 'in_review' ? 'update' : 'onboarding',
        },
      });
      const url = (res.data as { url?: unknown } | null)?.url;
      const isHttp = typeof url === 'string' && /^https?:\/\//i.test(url.trim());
      if (res.error || !isHttp) {
        const msg = await describeInvokeFailure(res.data, res.error);
        Alert.alert('Erro', msg || 'Não foi possível gerar o link de configuração.');
        setConnectLoading(false);
        return;
      }
      await Linking.openURL((url as string).trim());
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao abrir configuração de pagamento.');
    }
    setConnectLoading(false);
  };

  const handleStripeExpressLogin = async () => {
    setExpressLoginLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        Alert.alert('Erro', 'Sessão expirada. Faça login novamente.');
        return;
      }
      const res = await supabase.functions.invoke('stripe-connect-link', {
        body: { flow: 'express_login' },
      });
      const url = (res.data as { url?: unknown } | null)?.url;
      const isHttp = typeof url === 'string' && /^https?:\/\//i.test(url.trim());
      if (res.error || !isHttp) {
        const msg = await describeInvokeFailure(res.data, res.error);
        Alert.alert('Erro', msg || 'Não foi possível abrir o painel Stripe.');
        return;
      }
      await Linking.openURL((url as string).trim());
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao abrir o painel Stripe.');
    } finally {
      setExpressLoginLoading(false);
    }
  };

  const showStripeExpressLink = Boolean(stripeAccountId) && stripeState !== 'active';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pagamentos</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={GOLD} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Resumo do dia */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Recebido hoje</Text>
            <Text style={styles.summaryAmount}>{formatCents(totalCents)}</Text>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryRowLabel}>Corridas</Text>
              <Text style={styles.summaryRowValue}>{rides}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryRowLabel}>Gorjetas</Text>
              <Text style={styles.summaryRowValue}>{tips}</Text>
            </View>
          </View>

          {/* Chave Pix */}
          <TouchableOpacity
            style={styles.pixCard}
            onPress={() => { setNewPixKey(pixKey ?? ''); setEditPixVisible(true); }}
            activeOpacity={0.8}
          >
            <View style={styles.pixCardContent}>
              <Text style={styles.pixCardLabel}>
                {pixKey ? 'Chave Pix cadastrada' : 'Cadastrar chave Pix'}
              </Text>
              {pixKey && <Text style={styles.pixCardValue}>{pixKey}</Text>}
              <Text style={styles.pixCardHint}>
                {stripeState === 'active'
                  ? 'Usada para repasses manuais. O recebimento automático vai para a conta cadastrada na Stripe.'
                  : 'Usada para receber repasses manuais da equipe Take Me.'}
              </Text>
            </View>
            <MaterialIcons name="edit" size={20} color={GOLD} />
          </TouchableOpacity>

          {/* Recebimento automático via Stripe Connect (4 estados: none/incomplete/in_review/active) */}
          <StripeConnectCard
            state={stripeState}
            pendingVerificationCount={stripePendingVerification}
            loading={connectLoading}
            onPressSetup={handleStripeConnectSetup}
          />

          {showStripeExpressLink ? (
            <TouchableOpacity
              style={styles.stripeExpressLinkWrap}
              onPress={handleStripeExpressLogin}
              disabled={expressLoginLoading || connectLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.stripeExpressLinkText}>
                {expressLoginLoading
                  ? 'Abrindo painel Stripe…'
                  : 'Abrir painel Stripe do motorista (pendências e repasses)'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Transferências de hoje */}
          <Text style={styles.sectionTitle}>Transferências de hoje</Text>

          {transfers.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma transferência hoje.</Text>
          ) : (
            <View>
              {transfers.map((t, i) => (
                <View key={t.id}>
                  <View style={styles.transferRow}>
                    <PixIcon />
                    <View style={styles.transferInfo}>
                      <Text style={styles.transferAmount}>{formatCents(t.amount_cents)}</Text>
                      <Text style={styles.transferMeta}>
                        {t.source === 'completed_trip'
                          ? `Viagem concluída • ${formatHour(t.paid_at)}`
                          : `Pix • ${formatHour(t.paid_at)}`}
                      </Text>
                    </View>
                    <Text style={styles.transferDate}>{formatShortDate(t.paid_at)}</Text>
                  </View>
                  {i < transfers.length - 1 && <View style={styles.sep} />}
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.historyLink}
            onPress={() => navigation.navigate('PaymentHistory')}
            activeOpacity={0.7}
          >
            <Text style={styles.historyLinkText}>Ver histórico completo</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Modal editar Pix */}
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
                {savingPix
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.btnPrimaryText}>Salvar alteração</Text>
                }
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

type StripeCardCopy = {
  title: string;
  subtitle: string;
  borderColor: string;
  titleColor?: string;
  clickable: boolean;
  showArrow: boolean;
};

function stripeCardCopy(state: StripeConnectState, pendingVerificationCount: number): StripeCardCopy {
  switch (state) {
    case 'active':
      return {
        title: '✓ Recebimento automático ativo',
        subtitle: 'Seus pagamentos são depositados automaticamente via PIX.',
        borderColor: '#22C55E',
        titleColor: '#22C55E',
        clickable: false,
        showArrow: false,
      };
    case 'in_review':
      if (pendingVerificationCount > 0) {
        return {
          title: 'Ação pendente',
          subtitle:
            'Falta concluir algo na Stripe para liberar o recebimento automático (PIX). Toque no cartão para o formulário. Na página, role até o fim, confirme e use Editar se aparecer. Abaixo: painel Stripe com pendências.',
          borderColor: '#F59E0B',
          titleColor: '#92400E',
          clickable: true,
          showArrow: true,
        };
      }
      return {
        title: 'Ação pendente',
        subtitle:
          'O recebimento automático só libera depois que a Stripe aprovar seu cadastro. Toque no cartão para o formulário; role até o fim e confirme. Abaixo: painel Stripe com pendências.',
        borderColor: '#F59E0B',
        titleColor: '#92400E',
        clickable: true,
        showArrow: true,
      };
    case 'action_required':
      return {
        title: 'Ação necessária no cadastro Stripe',
        subtitle:
          'A Stripe pediu informações adicionais. Toque para abrir o formulário; role até o fim e confirme. Abaixo: painel Stripe com pendências.',
        borderColor: '#F59E0B',
        titleColor: '#92400E',
        clickable: true,
        showArrow: true,
      };
    case 'incomplete':
      return {
        title: 'Concluir configuração Stripe',
        subtitle: 'Seu cadastro ainda não foi finalizado — toque para retomar o onboarding.',
        borderColor: '#F59E0B',
        titleColor: '#92400E',
        clickable: true,
        showArrow: true,
      };
    case 'none':
    default:
      return {
        title: 'Ativar recebimento automático',
        subtitle: 'Configure para receber automaticamente via PIX após cada viagem.',
        borderColor: GOLD_BORDER,
        clickable: true,
        showArrow: true,
      };
  }
}

function StripeConnectCard({
  state,
  pendingVerificationCount,
  loading,
  onPressSetup,
}: {
  state: StripeConnectState;
  pendingVerificationCount: number;
  loading: boolean;
  onPressSetup: () => void;
}) {
  const copy = stripeCardCopy(state, pendingVerificationCount);
  return (
    <TouchableOpacity
      style={[styles.pixCard, { borderColor: copy.borderColor }]}
      onPress={copy.clickable && !loading ? onPressSetup : undefined}
      activeOpacity={copy.clickable ? 0.8 : 1}
      disabled={loading || !copy.clickable}
    >
      <View style={styles.pixCardContent}>
        <Text style={[styles.pixCardLabel, copy.titleColor ? { color: copy.titleColor } : null]}>
          {copy.title}
        </Text>
        <Text style={[styles.pixCardValue, { fontSize: 12, color: '#6B7280' }]}>
          {copy.subtitle}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={GOLD} />
      ) : copy.showArrow ? (
        <MaterialIcons name="arrow-forward" size={20} color={GOLD} />
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8 + SCREEN_TOP_EXTRA_PADDING,
    paddingBottom: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 20 },

  summaryCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
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
  pixCardHint: { fontSize: 12, color: '#6B7280', marginTop: 6, lineHeight: 16 },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 16 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginVertical: 12 },

  transferRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  pixIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center',
  },
  pixIconDiamond: { fontSize: 20, color: GOLD },
  transferInfo: { flex: 1 },
  transferAmount: { fontSize: 16, fontWeight: '700', color: '#111827' },
  transferMeta: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  transferDate: { fontSize: 14, color: '#9CA3AF' },
  sep: { height: 1, backgroundColor: '#F3F4F6' },

  historyLink: { alignItems: 'center', marginTop: 28 },
  historyLinkText: { fontSize: 15, color: '#111827', textDecorationLine: 'underline', fontWeight: '500' },

  stripeExpressLinkWrap: { alignItems: 'center', marginTop: -12, marginBottom: 28, paddingHorizontal: 8 },
  stripeExpressLinkText: {
    fontSize: 14,
    color: '#1D4ED8',
    textDecorationLine: 'underline',
    fontWeight: '600',
    textAlign: 'center',
  },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  sheetHandleRow: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' },
  sheetCloseBtn: { position: 'absolute', top: 12, right: 20, zIndex: 1 },
  sheetCloseCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  sheetHeaderContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20 },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 12 },
  sheetSubtitle: { fontSize: 16, color: '#6B7280', lineHeight: 24 },
  sheetDivider: { height: 1, backgroundColor: '#E5E7EB' },
  sheetBody: { paddingHorizontal: 24, paddingTop: 24, gap: 12 },
  inputLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  textInput: {
    backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 16, color: '#111827',
  },
  btnPrimary: {
    backgroundColor: '#0d0d0d', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  btnPrimaryText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  btnCancel: {
    backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  btnCancelText: { fontSize: 16, fontWeight: '600', color: '#DC2626' },
});
