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
const WARN_BG = '#FFFBEB';
const WARN_BORDER = '#F5D78A';
const WARN_TITLE = '#92400E';
const SUCCESS = '#16A34A';
const SUCCESS_BG = '#F0FDF4';
const SUCCESS_BORDER = '#BBF7D0';
const MUTED = '#6B7280';
const SUBTLE = '#9CA3AF';
const INK = '#111827';

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
          {/* Hero: recebido hoje */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Recebido hoje</Text>
            <Text style={styles.heroAmount}>{formatCents(totalCents)}</Text>
            <View style={styles.heroChips}>
              <View style={styles.chip}>
                <Text style={styles.chipValue}>{rides}</Text>
                <Text style={styles.chipLabel}>{rides === 1 ? 'corrida' : 'corridas'}</Text>
              </View>
              <View style={styles.chipDivider} />
              <View style={styles.chip}>
                <Text style={styles.chipValue}>{tips}</Text>
                <Text style={styles.chipLabel}>{tips === 1 ? 'gorjeta' : 'gorjetas'}</Text>
              </View>
            </View>
          </View>

          {/* Seção: Conta de recebimento */}
          <Text style={styles.sectionTitle}>Conta de recebimento</Text>

          <StripeConnectBlock
            state={stripeState}
            pendingVerificationCount={stripePendingVerification}
            loading={connectLoading}
            onPressSetup={handleStripeConnectSetup}
            showExpressLink={showStripeExpressLink}
            expressLoginLoading={expressLoginLoading}
            onPressExpress={handleStripeExpressLogin}
          />

          {/* Linha Pix compacta */}
          <TouchableOpacity
            style={styles.pixRow}
            onPress={() => { setNewPixKey(pixKey ?? ''); setEditPixVisible(true); }}
            activeOpacity={0.7}
          >
            <View style={styles.pixRowIcon}>
              <Text style={styles.pixRowDiamond}>◆</Text>
            </View>
            <View style={styles.pixRowInfo}>
              <Text style={styles.pixRowLabel}>Chave Pix (repasses manuais)</Text>
              <Text style={styles.pixRowValue} numberOfLines={1}>
                {pixKey ? pixKey : 'Toque para cadastrar'}
              </Text>
            </View>
            <MaterialIcons name="edit" size={18} color={SUBTLE} />
          </TouchableOpacity>

          {/* Transferências de hoje */}
          <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Transferências de hoje</Text>

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

type StripeBlockCopy = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  tone: 'warn' | 'neutral';
};

function stripeBlockCopy(state: StripeConnectState, pendingVerificationCount: number): StripeBlockCopy | null {
  switch (state) {
    case 'active':
      return null; // Estado ok — usamos badge verde, sem card
    case 'in_review':
      return {
        title: 'Ação pendente na Stripe',
        subtitle:
          pendingVerificationCount > 0
            ? 'Falta concluir algo para liberar o recebimento automático.'
            : 'Aguardando aprovação da Stripe. Toque para revisar o cadastro.',
        ctaLabel: 'Revisar cadastro',
        tone: 'warn',
      };
    case 'action_required':
      return {
        title: 'A Stripe pediu informações adicionais',
        subtitle: 'Complete o formulário para não interromper seus recebimentos.',
        ctaLabel: 'Completar cadastro',
        tone: 'warn',
      };
    case 'incomplete':
      return {
        title: 'Cadastro Stripe incompleto',
        subtitle: 'Finalize o cadastro para ativar o recebimento automático via PIX.',
        ctaLabel: 'Retomar cadastro',
        tone: 'warn',
      };
    case 'none':
    default:
      return {
        title: 'Ativar recebimento automático',
        subtitle: 'Receba via PIX automaticamente após cada viagem.',
        ctaLabel: 'Configurar Stripe',
        tone: 'neutral',
      };
  }
}

function StripeConnectBlock({
  state,
  pendingVerificationCount,
  loading,
  onPressSetup,
  showExpressLink,
  expressLoginLoading,
  onPressExpress,
}: {
  state: StripeConnectState;
  pendingVerificationCount: number;
  loading: boolean;
  onPressSetup: () => void;
  showExpressLink: boolean;
  expressLoginLoading: boolean;
  onPressExpress: () => void;
}) {
  if (state === 'active') {
    return (
      <View style={styles.statusActive}>
        <MaterialIcons name="check-circle" size={18} color={SUCCESS} />
        <Text style={styles.statusActiveText}>Recebimento automático ativo</Text>
      </View>
    );
  }

  const copy = stripeBlockCopy(state, pendingVerificationCount);
  if (!copy) return null;

  const isWarn = copy.tone === 'warn';

  return (
    <View style={[styles.stripeBlock, isWarn ? styles.stripeBlockWarn : styles.stripeBlockNeutral]}>
      <View style={styles.stripeBlockHeader}>
        {isWarn ? (
          <MaterialIcons name="info-outline" size={18} color={WARN_TITLE} style={{ marginRight: 8 }} />
        ) : null}
        <Text style={[styles.stripeBlockTitle, isWarn && { color: WARN_TITLE }]}>
          {copy.title}
        </Text>
      </View>
      <Text style={styles.stripeBlockSubtitle}>{copy.subtitle}</Text>

      <TouchableOpacity
        style={[styles.stripeCta, isWarn ? styles.stripeCtaWarn : styles.stripeCtaNeutral]}
        onPress={onPressSetup}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Text style={styles.stripeCtaText}>{copy.ctaLabel}</Text>
            <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
          </>
        )}
      </TouchableOpacity>

      {showExpressLink ? (
        <TouchableOpacity
          style={styles.expressLink}
          onPress={onPressExpress}
          disabled={expressLoginLoading || loading}
          activeOpacity={0.7}
        >
          <Text style={styles.expressLinkText}>
            {expressLoginLoading ? 'Abrindo painel Stripe…' : 'Abrir painel Stripe'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 24 },

  /* Hero */
  hero: { alignItems: 'center', marginBottom: 32 },
  heroLabel: { fontSize: 13, color: SUBTLE, marginBottom: 4, letterSpacing: 0.3 },
  heroAmount: { fontSize: 40, fontWeight: '700', color: INK, marginBottom: 16, letterSpacing: -0.5 },
  heroChips: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipValue: { fontSize: 15, fontWeight: '700', color: INK },
  chipLabel: { fontSize: 13, color: MUTED },
  chipDivider: { width: 1, height: 14, backgroundColor: '#E5E7EB', marginHorizontal: 14 },

  /* Seções */
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: SUBTLE,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },

  /* Stripe block */
  stripeBlock: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  stripeBlockWarn: { backgroundColor: WARN_BG, borderColor: WARN_BORDER },
  stripeBlockNeutral: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  stripeBlockHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  stripeBlockTitle: { fontSize: 15, fontWeight: '700', color: INK, flexShrink: 1 },
  stripeBlockSubtitle: { fontSize: 13, color: MUTED, lineHeight: 18, marginBottom: 12 },
  stripeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  stripeCtaWarn: { backgroundColor: '#B45309' },
  stripeCtaNeutral: { backgroundColor: INK },
  stripeCtaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  expressLink: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  expressLinkText: {
    fontSize: 13,
    color: WARN_TITLE,
    textDecorationLine: 'underline',
    fontWeight: '500',
  },

  /* Status ativo */
  statusActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SUCCESS_BG,
    borderWidth: 1,
    borderColor: SUCCESS_BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  statusActiveText: { fontSize: 14, fontWeight: '600', color: SUCCESS },

  /* Pix row */
  pixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  pixRowIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center',
  },
  pixRowDiamond: { fontSize: 16, color: GOLD },
  pixRowInfo: { flex: 1 },
  pixRowLabel: { fontSize: 12, color: SUBTLE, marginBottom: 2 },
  pixRowValue: { fontSize: 15, fontWeight: '600', color: INK },

  /* Transferências */
  emptyText: { fontSize: 14, color: SUBTLE, marginVertical: 8 },
  transferRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  pixIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center',
  },
  pixIconDiamond: { fontSize: 20, color: GOLD },
  transferInfo: { flex: 1 },
  transferAmount: { fontSize: 16, fontWeight: '700', color: INK },
  transferMeta: { fontSize: 13, color: SUBTLE, marginTop: 2 },
  transferDate: { fontSize: 14, color: SUBTLE },
  sep: { height: 1, backgroundColor: '#F3F4F6' },

  historyLink: { alignItems: 'center', marginTop: 24 },
  historyLinkText: { fontSize: 14, color: MUTED, textDecorationLine: 'underline', fontWeight: '500' },

  /* Modal */
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
  sheetTitle: { fontSize: 22, fontWeight: '700', color: INK, marginBottom: 12 },
  sheetSubtitle: { fontSize: 16, color: MUTED, lineHeight: 24 },
  sheetDivider: { height: 1, backgroundColor: '#E5E7EB' },
  sheetBody: { paddingHorizontal: 24, paddingTop: 24, gap: 12 },
  inputLabel: { fontSize: 15, fontWeight: '600', color: INK },
  textInput: {
    backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 16, color: INK,
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
