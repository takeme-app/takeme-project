import { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text } from '../../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ActivitiesStackParamList } from '../../navigation/ActivitiesStackTypes';
import { supabase } from '../../lib/supabase';

type Props = NativeStackScreenProps<ActivitiesStackParamList, 'ExcursionBudget'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

type BudgetLine = { label: string; amount_cents: number };

type ExcursionBudgetDetail = {
  id: string;
  destination: string;
  excursion_date: string;
  people_count: number;
  total_amount_cents: number | null;
  budget_lines: BudgetLine[] | null;
  payment_method: string | null;
};

const PAYMENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'credit_card', label: 'Cartão de crédito' },
  { value: 'debit_card', label: 'Cartão de débito' },
  { value: 'pix', label: 'Pix' },
  { value: 'cash', label: 'Dinheiro' },
];

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  const day = d.getDate();
  const months = 'Jan Fev Mar Abr Mai Jun Jul Ago Set Out Nov Dez'.split(' ');
  return `${day} ${months[d.getMonth()]}`;
}

function formatCents(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

export function ExcursionBudgetScreen({ navigation, route }: Props) {
  const excursionRequestId = route.params?.excursionRequestId ?? '';
  const [detail, setDetail] = useState<ExcursionBudgetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !excursionRequestId) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('excursion_requests')
        .select('id, destination, excursion_date, people_count, total_amount_cents, budget_lines, payment_method')
        .eq('id', excursionRequestId)
        .eq('user_id', user.id)
        .single();
      if (cancelled) return;
      if (error || !data) {
        setLoading(false);
        return;
      }
      setDetail(data as ExcursionBudgetDetail);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [excursionRequestId]);

  const handlePaymentSelect = async (method: string) => {
    if (!excursionRequestId || savingPayment) return;
    setSavingPayment(true);
    const { error } = await supabase
      .from('excursion_requests')
      .update({ payment_method: method })
      .eq('id', excursionRequestId);
    setSavingPayment(false);
    if (error) {
      Alert.alert('Erro', 'Não foi possível salvar o método de pagamento.');
      return;
    }
    setDetail((prev) => prev ? { ...prev, payment_method: method } : null);
  };

  const handleDownloadBudget = () => {
    if (!detail) return;
    const lines = (detail.budget_lines ?? []);
    const total = detail.total_amount_cents ?? 0;
    const text = [
      'Resumo da excursão',
      `Destino: ${detail.destination}`,
      `Data: ${formatDate(detail.excursion_date)}`,
      `Pessoas: ${detail.people_count}`,
      '',
      'Orçamento',
      ...lines.map((l) => `${l.label}: ${formatCents(l.amount_cents)}`),
      '',
      `Total: ${formatCents(total)}`,
    ].join('\n');
    Alert.alert('Orçamento', 'Conteúdo do orçamento gerado. Em produção você pode compartilhar ou salvar como arquivo.', [
      { text: 'OK' },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="close" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhes da excursão</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.black} />
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="close" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhes da excursão</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.mutedText}>Orçamento não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const lines = (detail.budget_lines ?? []) as BudgetLine[];
  const total = detail.total_amount_cents ?? 0;
  const hasBudget = lines.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="close" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes da excursão</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Detalhes do orçamento</Text>
        <Text style={styles.sectionSubtitle}>Confira o resumo da sua excursão antes de prosseguir com o pagamento.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resumo da excursão</Text>
          <View style={styles.summaryRow}>
            <MaterialIcons name="place" size={20} color={COLORS.neutral700} />
            <Text style={styles.summaryText}>{detail.destination}</Text>
          </View>
          <View style={styles.summaryRow}>
            <MaterialIcons name="event" size={20} color={COLORS.neutral700} />
            <Text style={styles.summaryText}>{formatDate(detail.excursion_date)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <MaterialIcons name="people" size={20} color={COLORS.neutral700} />
            <Text style={styles.summaryText}>{detail.people_count} pessoas</Text>
          </View>
        </View>

        {hasBudget ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Resumo da excursão</Text>
              {lines.map((line, i) => (
                <View key={i} style={styles.budgetRow}>
                  <Text style={styles.budgetLabel}>{line.label}</Text>
                  <Text style={styles.budgetValue}>{formatCents(line.amount_cents)}</Text>
                </View>
              ))}
              <View style={[styles.budgetRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatCents(total)}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadBudget}>
              <MaterialIcons name="download" size={20} color={COLORS.black} />
              <Text style={styles.downloadButtonText}>Baixar orçamento</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.mutedText}>Orçamento em preparação. Você será notificado quando estiver pronto.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Método de pagamento</Text>
        {PAYMENT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={styles.paymentRow}
            onPress={() => handlePaymentSelect(opt.value)}
            disabled={savingPayment}
          >
            <Text style={styles.paymentLabel}>{opt.label}</Text>
            {detail.payment_method === opt.value ? (
              <MaterialIcons name="radio-button-checked" size={24} color={COLORS.black} />
            ) : (
              <MaterialIcons name="radio-button-unchecked" size={24} color={COLORS.neutral700} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral400,
  },
  closeButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.black, flex: 1, textAlign: 'center' },
  headerSpacer: { width: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mutedText: { fontSize: 15, color: COLORS.neutral700 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.black, marginBottom: 8 },
  sectionSubtitle: { fontSize: 14, color: COLORS.neutral700, marginBottom: 16 },
  card: {
    backgroundColor: COLORS.neutral300,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: COLORS.black, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  summaryText: { fontSize: 15, color: COLORS.black, flex: 1 },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  budgetLabel: { fontSize: 15, color: COLORS.black },
  budgetValue: { fontSize: 15, color: COLORS.black },
  totalRow: { marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.neutral400, paddingTop: 12 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  totalValue: { fontSize: 18, fontWeight: '700', color: COLORS.black },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.neutral300,
    marginBottom: 24,
  },
  downloadButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral400,
  },
  paymentLabel: { fontSize: 16, color: COLORS.black },
});
