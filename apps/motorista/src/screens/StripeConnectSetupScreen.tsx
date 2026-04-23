import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { Text } from '../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import {
  canUseAppWithStripeState,
  getStripeConnectState,
  subtypeToMainRoute,
  type StripeConnectState,
} from '../lib/motoristaAccess';
import { SCREEN_TOP_EXTRA_PADDING } from '../theme/screenLayout';
import { describeInvokeFailure } from '../utils/edgeFunctionResponse';

function isOpenableHttpUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  return /^https?:\/\//i.test(trimmed);
}

type Props = NativeStackScreenProps<RootStackParamList, 'StripeConnectSetup'>;

const GOLD = '#C9A227';

export function StripeConnectSetupScreen({ navigation, route }: Props) {
  const subtype = route.params?.subtype ?? 'takeme';
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [stripeState, setStripeState] = useState<StripeConnectState>('none');
  const [stripePendingVerification, setStripePendingVerification] = useState(0);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [expressLoginLoading, setExpressLoginLoading] = useState(false);

  const gateCheckGen = useRef(0);
  const navigateAfterStripeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearNavigateAfterStripeTimer = useCallback(() => {
    if (navigateAfterStripeTimerRef.current) {
      clearTimeout(navigateAfterStripeTimerRef.current);
      navigateAfterStripeTimerRef.current = null;
    }
  }, []);

  // Sincroniza com a Stripe e lê o banco. `useFocusEffect` sozinho não reexecuta
  // quando o utilizador volta do Safari/Chrome (a tela continua focada na stack).
  const syncStripeGateFromServer = useCallback(async () => {
    const gen = ++gateCheckGen.current;
    setChecking(true);
    try {
      await supabase.functions.invoke('stripe-connect-sync', { body: {} }).catch(() => undefined);
      if (gen !== gateCheckGen.current) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || gen !== gateCheckGen.current) return;
      const { data: wp } = await supabase
        .from('worker_profiles')
        .select('stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_details_submitted, stripe_connect_requirements_due_count, stripe_connect_pending_verification_count')
        .eq('id', user.id)
        .maybeSingle();
      if (gen !== gateCheckGen.current) return;
      const state = getStripeConnectState(wp);
      setStripeState(state);
      setStripePendingVerification(Number(wp?.stripe_connect_pending_verification_count ?? 0) || 0);
      const acct = (wp?.stripe_connect_account_id as string | null | undefined)?.trim() ?? '';
      setStripeAccountId(acct || null);
      if (canUseAppWithStripeState(state)) {
        clearNavigateAfterStripeTimer();
        navigateAfterStripeTimerRef.current = setTimeout(() => {
          navigateAfterStripeTimerRef.current = null;
          if (gen === gateCheckGen.current) {
            navigation.reset({ index: 0, routes: [{ name: subtypeToMainRoute(subtype) }] });
          }
        }, 1500);
      }
    } finally {
      if (gen === gateCheckGen.current) setChecking(false);
    }
  }, [navigation, subtype, clearNavigateAfterStripeTimer]);

  useFocusEffect(
    useCallback(() => {
      void syncStripeGateFromServer();
      return () => {
        clearNavigateAfterStripeTimer();
      };
    }, [syncStripeGateFromServer, clearNavigateAfterStripeTimer])
  );

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        void syncStripeGateFromServer();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [syncStripeGateFromServer]);

  useEffect(() => () => {
    gateCheckGen.current += 1;
    clearNavigateAfterStripeTimer();
  }, [clearNavigateAfterStripeTimer]);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        Alert.alert('Erro', 'Sessão expirada. Faça login novamente.');
        setLoading(false);
        return;
      }
      const res = await supabase.functions.invoke('stripe-connect-link', {
        body: {
          return_url: 'take-me-motorista://stripe-connect-return',
          refresh_url: 'take-me-motorista://stripe-connect-return',
          link_type:
            stripeState === 'action_required' || stripeState === 'in_review' ? 'update' : 'onboarding',
        },
      });
      const url = (res.data as { url?: unknown } | null)?.url;
      if (res.error || !isOpenableHttpUrl(url)) {
        const msg = await describeInvokeFailure(res.data, res.error);
        Alert.alert('Erro', msg || 'Não foi possível gerar o link de configuração. Tente novamente.');
        setLoading(false);
        return;
      }
      await Linking.openURL(url);
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao abrir configuracao.');
    }
    setLoading(false);
  };

  const handleExpressLogin = async () => {
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
      if (res.error || !isOpenableHttpUrl(url)) {
        const msg = await describeInvokeFailure(res.data, res.error);
        Alert.alert('Erro', msg || 'Não foi possível abrir o painel Stripe.');
        return;
      }
      await Linking.openURL(url.trim());
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao abrir o painel Stripe.');
    } finally {
      setExpressLoginLoading(false);
    }
  };

  if (stripeState === 'active') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <MaterialIcons name="check-circle" size={64} color="#22C55E" />
          <Text style={styles.successTitle}>Tudo pronto!</Text>
          <Text style={styles.successSubtitle}>
            Seu recebimento automatico via PIX esta configurado. Redirecionando...
          </Text>
          <ActivityIndicator size="small" color={GOLD} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  if (stripeState === 'in_review') {
    const reviewBody =
      stripePendingVerification > 0
        ? 'Sem concluir o que a Stripe pedir, o recebimento automático não libera. Use o botão abaixo para abrir o site da Stripe e enviar o que faltar.'
        : 'O recebimento automático só libera após a Stripe aprovar. Use o botão abaixo para abrir a Stripe e concluir ou corrigir dados.';
    const reviewTitle = 'Ação pendente';
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <MaterialIcons name="hourglass-top" size={64} color="#B45309" />
          <Text style={styles.successTitle}>{reviewTitle}</Text>
          <Text style={styles.successSubtitle}>
            {reviewBody}
          </Text>
          <TouchableOpacity
            style={[styles.btnPrimary, { marginTop: 24, marginHorizontal: 24, alignSelf: 'stretch' }, (loading || checking) && { opacity: 0.6 }]}
            onPress={handleSetup}
            disabled={loading || checking}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="open-in-new" size={20} color="#fff" />
                <Text style={styles.btnPrimaryText}>Abrir cadastro na Stripe</Text>
              </>
            )}
          </TouchableOpacity>
          {stripeAccountId ? (
            <TouchableOpacity
              style={{ marginTop: 16, marginHorizontal: 24, alignSelf: 'stretch' }}
              onPress={handleExpressLogin}
              disabled={expressLoginLoading || loading || checking}
              activeOpacity={0.7}
            >
              <Text style={styles.expressLinkText}>
                {expressLoginLoading
                  ? 'Abrindo painel…'
                  : 'Abrir painel Stripe do motorista (pendências e repasses)'}
              </Text>
            </TouchableOpacity>
          ) : null}
          {checking ? <ActivityIndicator size="small" color={GOLD} style={{ marginTop: 16 }} /> : null}
        </View>
      </SafeAreaView>
    );
  }

  const isIncomplete = stripeState === 'incomplete';
  const isActionRequired = stripeState === 'action_required';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="account-balance" size={48} color={GOLD} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Configure seu recebimento</Text>
        <Text style={styles.subtitle}>
          Para receber seus ganhos automaticamente via PIX apos cada viagem, configure sua conta de recebimento.
        </Text>

        {/* Benefits */}
        <View style={styles.benefitsCard}>
          <BenefitRow icon="flash-on" text="Receba automaticamente apos cada viagem" />
          <BenefitRow icon="pix" text="Deposito direto via PIX na sua conta" />
          <BenefitRow icon="security" text="Seguro e protegido pelo Stripe" />
          <BenefitRow icon="schedule" text="Sem necessidade de solicitar pagamento" />
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <MaterialIcons name="info-outline" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            Voce sera redirecionado para uma pagina segura do Stripe onde vai cadastrar seus dados bancarios e chave PIX. O processo leva cerca de 2 minutos.
          </Text>
        </View>

        {isIncomplete && (
          <View style={[styles.infoCard, styles.pendingCard]}>
            <MaterialIcons name="hourglass-empty" size={20} color="#B45309" />
            <Text style={[styles.infoText, styles.pendingText]}>
              Seu cadastro no Stripe ainda não foi concluído. Toque em "Continuar configuração" para retomar o onboarding.
            </Text>
          </View>
        )}

        {isActionRequired && (
          <View style={[styles.infoCard, styles.pendingCard]}>
            <MaterialIcons name="error-outline" size={20} color="#B45309" />
            <Text style={[styles.infoText, styles.pendingText]}>
              A Stripe pediu informações adicionais para liberar o recebimento automático. Toque em "Completar informações" para enviar os dados pendentes.
            </Text>
          </View>
        )}

        {/* Main CTA */}
        <TouchableOpacity
          style={[styles.btnPrimary, loading && { opacity: 0.6 }]}
          onPress={handleSetup}
          disabled={loading || checking}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialIcons name="arrow-forward" size={20} color="#fff" />
              <Text style={styles.btnPrimaryText}>
                {isActionRequired
                  ? 'Completar informações'
                  : isIncomplete
                    ? 'Continuar configuração'
                    : 'Configurar recebimento automático'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {stripeAccountId ? (
          <TouchableOpacity
            onPress={handleExpressLogin}
            disabled={expressLoginLoading || loading || checking}
            activeOpacity={0.7}
            style={{ width: '100%', marginBottom: 8 }}
          >
            <Text style={styles.expressLinkText}>
              {expressLoginLoading
                ? 'Abrindo painel Stripe…'
                : 'Abrir painel Stripe do motorista (pendências e repasses)'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* TEMPORÁRIO: permite pular o onboarding da Stripe e ir direto para a Home.
            Remover quando o cadastro Stripe voltar a ser obrigatório no fluxo. */}
        <TouchableOpacity
          style={styles.btnSkip}
          onPress={() => {
            navigation.reset({ index: 0, routes: [{ name: subtypeToMainRoute(subtype) }] });
          }}
          disabled={loading || checking}
          activeOpacity={0.7}
        >
          <Text style={styles.btnSkipText}>Configurar mais tarde</Text>
        </TouchableOpacity>


        <Text style={styles.mandatoryNote}>
          O cadastro Stripe é obrigatório para acessar a plataforma.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function BenefitRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.benefitRow}>
      <MaterialIcons name={icon as any} size={22} color="#22C55E" />
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 40 + SCREEN_TOP_EXTRA_PADDING,
    paddingBottom: 40,
    alignItems: 'center',
  },
  iconContainer: { marginBottom: 24 },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFFBEB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    fontFamily: 'Inter_400Regular',
  },
  benefitsCard: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    marginBottom: 20,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    fontFamily: 'Inter_500Medium',
  },
  infoCard: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 28,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  btnPrimary: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#C9A227',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
  },
  btnSkip: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  btnSkipText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
    fontFamily: 'Inter_500Medium',
  },
  mandatoryNote: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 12,
    fontFamily: 'Inter_400Regular',
  },
  pendingCard: {
    backgroundColor: '#FEF3C7',
  },
  pendingText: {
    color: '#92400E',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    fontFamily: 'Inter_700Bold',
  },
  successSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  expressLinkText: {
    fontSize: 14,
    color: '#1D4ED8',
    textDecorationLine: 'underline',
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
});
