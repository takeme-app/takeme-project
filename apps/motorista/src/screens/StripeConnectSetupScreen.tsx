import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Text } from '../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { subtypeToMainRoute } from '../lib/motoristaAccess';
import { SCREEN_TOP_EXTRA_PADDING } from '../theme/screenLayout';

type Props = NativeStackScreenProps<RootStackParamList, 'StripeConnectSetup'>;

const GOLD = '#C9A227';

export function StripeConnectSetupScreen({ navigation, route }: Props) {
  const subtype = route.params?.subtype ?? 'takeme';
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [hasConnect, setHasConnect] = useState(false);

  // Ao voltar para essa tela (ex: após onboarding no browser), verificar se já configurou
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const check = async () => {
        setChecking(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) { setChecking(false); return; }
        const { data: wp } = await supabase
          .from('worker_profiles')
          .select('stripe_connect_account_id')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (wp?.stripe_connect_account_id) {
          setHasConnect(true);
          // Auto-navegar para o app principal
          setTimeout(() => {
            if (!cancelled) {
              navigation.reset({ index: 0, routes: [{ name: subtypeToMainRoute(subtype) }] });
            }
          }, 1500);
        }
        setChecking(false);
      };
      check();
      return () => { cancelled = true; };
    }, [navigation, subtype])
  );

  const handleSetup = async () => {
    setLoading(true);
    try {
      const res = await supabase.functions.invoke('stripe-connect-link', {
        body: {
          return_url: 'takeme://stripe-connect-return',
          refresh_url: 'takeme://stripe-connect-return',
        },
      });
      if (res.error || !res.data?.url) {
        Alert.alert('Erro', res.error?.message || 'Falha ao gerar link de configuracao.');
        setLoading(false);
        return;
      }
      await Linking.openURL(res.data.url);
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao abrir configuracao.');
    }
    setLoading(false);
  };

  const handleSkip = () => {
    Alert.alert(
      'Pular configuracao?',
      'Sem o recebimento automatico, seus pagamentos precisarao ser liberados manualmente pelo administrador via PIX. Deseja continuar sem configurar?',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Continuar sem configurar',
          style: 'destructive',
          onPress: () => {
            navigation.reset({ index: 0, routes: [{ name: subtypeToMainRoute(subtype) }] });
          },
        },
      ]
    );
  };

  if (hasConnect) {
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
              <Text style={styles.btnPrimaryText}>Configurar recebimento automatico</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Skip */}
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Configurar depois (pagamento manual)</Text>
        </TouchableOpacity>
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
  skipBtn: {
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 14,
    color: '#9CA3AF',
    textDecorationLine: 'underline',
    fontFamily: 'Inter_400Regular',
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
});
