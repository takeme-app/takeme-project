import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackTypes';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { getUserErrorMessage } from '../../utils/errorMessage';

/** Em respostas não-2xx o body vem em error.context (Response); retorna objeto parseado ou null. */
async function parseErrorBody(error: unknown): Promise<Record<string, unknown> | null> {
  const ctx = error != null && typeof error === 'object' && 'context' in error
    ? (error as { context?: Response }).context
    : undefined;
  if (!ctx || typeof (ctx as Response).json !== 'function') return null;
  try {
    const body = await (ctx as Response).json();
    return body != null && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function safeGetUserErrorMessage(error: unknown, fallback: string): string {
  try {
    return getUserErrorMessage(error, fallback);
  } catch {
    return fallback;
  }
}

type Props = NativeStackScreenProps<ProfileStackParamList, 'About'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral700: '#767676',
};

const CARDS = [
  {
    id: 'privacy',
    title: 'Política de privacidade',
    description: 'Entenda como tratamos e protegemos seus dados.',
    icon: 'security' as const,
    screen: 'PrivacyPolicy' as const,
  },
  {
    id: 'terms',
    title: 'Termos de uso',
    description: 'Leia as condições de uso da plataforma.',
    icon: 'description' as const,
    screen: 'TermsOfUse' as const,
  },
  {
    id: 'cancellation',
    title: 'Política de cancelamento de viagens',
    description: 'Saiba como funcionam prazos e reembolsos em cancelamentos.',
    icon: 'cancel' as const,
    screen: 'CancellationPolicy' as const,
  },
  {
    id: 'consent',
    title: 'Termo de Consentimento (LGPD)',
    description: 'Consentimentos para tratamento de dados pessoais.',
    icon: 'policy' as const,
    screen: 'ConsentTerm' as const,
  },
  {
    id: 'data-export',
    title: 'Solicitar cópia dos meus dados',
    description: 'Peça acesso aos dados obrigatórios já fornecidos à plataforma.',
    icon: 'folder-open' as const,
    action: 'requestDataExport' as const,
  },
];

export function AboutScreen({ navigation }: Props) {
  const [exportLoading, setExportLoading] = useState(false);

  const handleCardPress = async (item: (typeof CARDS)[number]) => {
    if ('screen' in item && item.screen) {
      navigation.navigate(item.screen);
      return;
    }
    if (item.action === 'requestDataExport') {
      setExportLoading(true);
      // Alert nativo garante que o usuário sempre veja o feedback (modal do contexto às vezes não aparece)
      const showFeedback = (title: string, message: string) => {
        Alert.alert(title, message);
      };
      const fallbackMsg = 'Não foi possível solicitar a cópia. Tente novamente.';
      try {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          showFeedback('Erro', 'Sessão expirada. Faça login novamente.');
          return;
        }
        const { data, error } = await supabase.functions.invoke('request-data-export');
        // Em respostas não-2xx o Supabase coloca data = null; o body vem em error.context (Response)
        let body: Record<string, unknown> | null = data != null && typeof data === 'object' ? (data as Record<string, unknown>) : null;
        if (body == null && error) body = await parseErrorBody(error).catch(() => null);
        if (body?.error === 'rate_limited' && typeof body.message === 'string') {
          showFeedback('Solicitar cópia dos dados', body.message);
          return;
        }
        if (error) {
          // Preferir mensagem do body (retornada pela Edge Function) em vez da genérica do cliente
          const serverMsg =
            (typeof body?.message === 'string' && body.message) ||
            (typeof body?.error === 'string' && body.error) ||
            safeGetUserErrorMessage(error, fallbackMsg);
          showFeedback('Erro', serverMsg);
          return;
        }
        if (body?.error && typeof body.error === 'string') {
          showFeedback('Erro', body.error);
          return;
        }
        showFeedback(
          'Solicitar cópia dos dados',
          'Enviaremos por e-mail em breve. Verifique sua caixa de entrada (e spam).'
        );
      } catch (e) {
        const msg = safeGetUserErrorMessage(e, fallbackMsg);
        showFeedback('Erro', msg);
      } finally {
        setExportLoading(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navbarButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.navbarTitle} numberOfLines={1}>Sobre</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {CARDS.map((item) => {
          const isExportCard = 'action' in item && item.action === 'requestDataExport';
          const isLoading = isExportCard && exportLoading;
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => handleCardPress(item)}
              activeOpacity={0.7}
              disabled={isLoading}
            >
              <View style={styles.cardIconWrap}>
                <MaterialIcons name={item.icon} size={24} color={COLORS.black} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
              </View>
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.neutral700} />
              ) : (
                <MaterialIcons name="chevron-right" size={24} color={COLORS.neutral700} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navbarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navbarTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.black, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  cardDescription: { fontSize: 13, color: COLORS.neutral700, marginTop: 4 },
});
