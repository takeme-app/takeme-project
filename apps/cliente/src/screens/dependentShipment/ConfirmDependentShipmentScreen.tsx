import { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Text } from '../../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DependentShipmentStackParamList } from '../../navigation/types';
import { PaymentMethodSection, type PaymentMethodType } from '../../components/PaymentMethodSection';
import { supabase } from '../../lib/supabase';
import { useAppAlert } from '../../contexts/AppAlertContext';
import { getUserErrorMessage } from '../../utils/errorMessage';

type Props = NativeStackScreenProps<DependentShipmentStackParamList, 'ConfirmDependentShipment'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral700: '#767676',
};

function orderIdFromUuid(uuid: string): string {
  return uuid.replace(/-/g, '').slice(-4).toUpperCase();
}

function formatPhoneDisplay(digits: string): string {
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function ConfirmDependentShipmentScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();
  const {
    origin,
    destination,
    whenOption,
    whenLabel,
    fullName,
    contactPhone,
    bagsCount,
    instructions,
    dependentId,
    amountCents,
  } = route.params;
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const amountFormatted = `R$ ${(amountCents / 100).toFixed(2).replace('.', ',')}`;
  const contactDisplay = formatPhoneDisplay(contactPhone);

  const handleConfirmPayment = useCallback(
    async (params: { method: PaymentMethodType; paymentMethodId?: string }) => {
      setSubmitting(true);
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
          showAlert('Erro', 'Faça login para continuar.');
          setSubmitting(false);
          return;
        }
        const paymentMethodDb =
          params.method === 'credito'
            ? 'credito'
            : params.method === 'debito'
              ? 'debito'
              : params.method === 'pix'
                ? 'pix'
                : 'dinheiro';
        const status = 'pending_review';
        const { data: row, error } = await supabase
          .from('dependent_shipments')
          .insert({
            user_id: user.id,
            dependent_id: dependentId ?? null,
            full_name: fullName,
            contact_phone: contactPhone,
            bags_count: bagsCount,
            instructions: instructions ?? null,
            origin_address: origin.address,
            origin_lat: origin.latitude,
            origin_lng: origin.longitude,
            destination_address: destination.address,
            destination_lat: destination.latitude,
            destination_lng: destination.longitude,
            when_option: whenOption,
            scheduled_at: whenOption === 'later' ? null : null,
            payment_method: paymentMethodDb,
            amount_cents: amountCents,
            status,
          })
          .select('id')
          .single();
        if (error) {
          showAlert('Erro', getUserErrorMessage(error, 'Não foi possível registrar o envio. Tente novamente.'));
          setSubmitting(false);
          return;
        }
        const shipmentId = row?.id;
        const orderId = shipmentId ? orderIdFromUuid(shipmentId) : '----';

        if (shipmentId && (params.method === 'credito' || params.method === 'debito') && params.paymentMethodId) {
          const { data: chargeData, error: chargeFnError } = await supabase.functions.invoke('charge-shipment', {
            body: {
              dependent_shipment_id: shipmentId,
              stripe_payment_method_id: params.paymentMethodId,
            },
          });
          const chargeErrMsg =
            chargeFnError?.message ??
            (chargeData && typeof chargeData === 'object' && 'error' in chargeData
              ? String((chargeData as { error?: string }).error ?? '')
              : '');
          if (chargeErrMsg) {
            await supabase
              .from('dependent_shipments')
              .update({ status: 'cancelled', updated_at: new Date().toISOString() } as never)
              .eq('id', shipmentId);
            showAlert(
              'Pagamento',
              chargeErrMsg || 'Não foi possível confirmar o pagamento; o pedido foi cancelado.',
            );
            setSubmitting(false);
            return;
          }
        }

        navigation.replace('DependentShipmentSuccess', {
          orderId,
          shipmentId: shipmentId ?? undefined,
        });
      } catch (e) {
        showAlert('Erro', 'Ocorreu um erro. Tente novamente.');
      } finally {
        setSubmitting(false);
      }
    },
    [
      dependentId,
      fullName,
      contactPhone,
      bagsCount,
      instructions,
      origin,
      destination,
      whenOption,
      amountCents,
      navigation,
      showAlert,
    ]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirme o envio do dependente</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Destinatário</Text>
          <Text style={styles.summaryText}>{fullName} • {contactDisplay}</Text>
          <Text style={styles.summaryMeta}>Bagagens: {bagsCount} {bagsCount === 1 ? 'mala' : 'malas'}</Text>
          {instructions ? <Text style={styles.summaryMeta}>Instruções: {instructions}</Text> : null}
          <View style={styles.divider} />
          <Text style={styles.summaryMeta}>De: {origin.address}</Text>
          <Text style={styles.summaryMeta}>Para: {destination.address}</Text>
          <Text style={styles.summaryMeta}>Quando: {whenOption === 'later' && whenLabel ? whenLabel : 'Agora'}</Text>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryPrice}>{amountFormatted}</Text>
          </View>
        </View>

        <PaymentMethodSection
          amountCents={amountCents}
          selectedMethod={selectedPaymentMethod}
          onSelectMethod={setSelectedPaymentMethod}
          onConfirmPayment={handleConfirmPayment}
          confirmLabel="Confirmar envio"
          cancellationPolicyVariant="shipment_debit"
          loading={submitting}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.neutral300, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.black },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 32 },
  summaryCard: {
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryLabel: { fontSize: 14, fontWeight: '600', color: COLORS.black, marginBottom: 4 },
  summaryText: { fontSize: 15, color: COLORS.black, marginBottom: 4 },
  summaryMeta: { fontSize: 14, color: COLORS.neutral700, marginBottom: 4 },
  summaryPrice: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  divider: { height: 1, backgroundColor: '#ddd', marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
});
