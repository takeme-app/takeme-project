import { useState, useCallback, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Text } from '../../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ShipmentStackParamList } from '../../navigation/types';
import { PaymentMethodSection, type PaymentMethodType } from '../../components/PaymentMethodSection';
import { supabase } from '../../lib/supabase';
import { tryOpenSupportTicket } from '../../lib/supportTickets';
import { resolveShipmentBaseId } from '../../lib/resolveShipmentBase';
import { useAppAlert } from '../../contexts/AppAlertContext';
import { getUserErrorMessage } from '../../utils/errorMessage';

type Props = NativeStackScreenProps<ShipmentStackParamList, 'ConfirmShipment'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

const PACKAGE_SIZE_SUBTITLES: Record<string, string> = {
  pequeno: 'Cabe em uma mochila',
  medio: 'Cabe em uma mala de mão',
  grande: 'Precisa de avaliação do nosso time',
};

function orderIdFromUuid(uuid: string): string {
  return uuid.replace(/-/g, '').slice(-4).toUpperCase();
}

export function ConfirmShipmentScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();
  const {
    origin,
    destination,
    whenOption,
    whenLabel,
    packageSize,
    packageSizeLabel,
    recipient,
    amountCents,
    subtotalCents,
    feeCents,
  } = route.params;
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refreshCheckout = useCallback(() => {
    // Quando houver API de status de pagamento ou preço dinâmico, buscar aqui e atualizar estado (ex.: setAmountCents, status de pagamento).
  }, []);

  useEffect(() => {
    const interval = setInterval(refreshCheckout, 5000);
    return () => clearInterval(interval);
  }, [refreshCheckout]);

  const showFeeBreakdown = subtotalCents != null && feeCents != null;
  const amountFormatted = `R$ ${(amountCents / 100).toFixed(2).replace('.', ',')}`;
  const formatBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
  const cancellationVariant =
    selectedPaymentMethod === 'credito'
      ? 'shipment_credit'
      : selectedPaymentMethod === 'debito'
        ? 'shipment_debit'
        : 'shipment_debit';

  const uploadPhotoAndGetPath = useCallback(
    async (userId: string, localUri: string): Promise<string | null> => {
      try {
        const res = await fetch(localUri);
        const blob = await res.blob();
        const ext = localUri.split('.').pop()?.toLowerCase() === 'png' ? 'png' : 'jpg';
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
        const { error } = await supabase.storage
          .from('shipment-photos')
          .upload(path, blob, { contentType: ext === 'png' ? 'image/png' : 'image/jpeg' });
        if (error) return null;
        return path;
      } catch {
        return null;
      }
    },
    []
  );

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
          return;
        }
        let photoUrl: string | null = null;
        if (recipient.photoUri) {
          photoUrl = await uploadPhotoAndGetPath(user.id, recipient.photoUri);
        }
        const paymentMethodDb =
          params.method === 'credito'
            ? 'credito'
            : params.method === 'debito'
              ? 'debito'
              : params.method === 'pix'
                ? 'pix'
                : 'dinheiro';
        const status =
          packageSize === 'grande' ? 'pending_review' : params.method === 'dinheiro' ? 'confirmed' : 'confirmed';
        const baseId = await resolveShipmentBaseId({
          origin: { latitude: origin.latitude, longitude: origin.longitude },
          originAddress: origin.address,
        });
        const { data: row, error } = await supabase
          .from('shipments')
          .insert({
            user_id: user.id,
            origin_address: origin.address,
            origin_lat: origin.latitude,
            origin_lng: origin.longitude,
            destination_address: destination.address,
            destination_lat: destination.latitude,
            destination_lng: destination.longitude,
            when_option: whenOption,
            scheduled_at: whenOption === 'later' ? null : null,
            package_size: packageSize,
            recipient_name: recipient.name,
            recipient_email: recipient.email,
            recipient_phone: recipient.phone,
            instructions: recipient.instructions ?? null,
            photo_url: photoUrl,
            payment_method: paymentMethodDb,
            amount_cents: amountCents,
            status,
            ...(baseId ? { base_id: baseId } : {}),
          })
          .select('id')
          .single();
        if (error) {
          showAlert('Erro', getUserErrorMessage(error, 'Não foi possível registrar o envio. Tente novamente.'));
          return;
        }
        const shipmentId = row?.id;
        const orderId = shipmentId ? orderIdFromUuid(shipmentId) : '----';
        const isLargePackage = packageSize === 'grande';
        if (isLargePackage && shipmentId) void tryOpenSupportTicket('encomendas', { shipment_id: shipmentId });
        const paymentProcessed =
          params.method === 'credito' || params.method === 'debito' || params.method === 'pix';

        if (shipmentId && (params.method === 'credito' || params.method === 'debito') && params.paymentMethodId) {
          const { data: chargeData, error: chargeFnError } = await supabase.functions.invoke('charge-shipment', {
            body: {
              shipment_id: shipmentId,
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
              .from('shipments')
              .update({ status: 'cancelled', updated_at: new Date().toISOString() } as never)
              .eq('id', shipmentId);
            showAlert(
              'Pagamento',
              chargeErrMsg || 'Não foi possível confirmar o pagamento; o pedido foi cancelado.',
            );
            return;
          }
        }

        navigation.replace('ShipmentSuccess', {
          orderId,
          shipmentId: shipmentId ?? undefined,
          isLargePackage,
          paymentProcessed,
        });
      } catch (e) {
        showAlert('Erro', 'Ocorreu um erro. Tente novamente.');
      } finally {
        setSubmitting(false);
      }
    },
    [
      origin,
      destination,
      whenOption,
      packageSize,
      recipient,
      amountCents,
      navigation,
      showAlert,
      uploadPhotoAndGetPath,
    ]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirme os detalhes do envio</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Envio para {recipient.name}</Text>
            {!showFeeBreakdown && <Text style={styles.summaryPrice}>{amountFormatted}</Text>}
          </View>
          {showFeeBreakdown && (
            <>
              <View style={styles.summaryFeeRow}>
                <Text style={styles.summaryMeta}>Subtotal</Text>
                <Text style={styles.summaryMeta}>{formatBRL(subtotalCents!)}</Text>
              </View>
              <View style={styles.summaryFeeRow}>
                <Text style={styles.summaryMeta}>Taxa administrativa</Text>
                <Text style={styles.summaryMeta}>{formatBRL(feeCents!)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total</Text>
                <Text style={styles.summaryPrice}>{amountFormatted}</Text>
              </View>
            </>
          )}
          {!showFeeBreakdown && (
            <Text style={styles.summaryMetaNote}>Valor total já inclui taxa quando aplicável.</Text>
          )}
          <Text style={styles.summaryDynamicPriceNote}>
            O valor final pode variar conforme o horário de solicitação e da partida.
          </Text>
          {showFeeBreakdown && <View style={styles.summarySpacer} />}
          <View style={styles.summaryLine}>
            <MaterialIcons name="inventory-2" size={20} color={COLORS.neutral700} />
            <Text style={styles.summaryText}>
              {packageSizeLabel} • {PACKAGE_SIZE_SUBTITLES[packageSize] ?? packageSize}
            </Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryText} numberOfLines={1}>{origin.address}</Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryText} numberOfLines={1}>{destination.address}</Text>
          </View>
          <Text style={styles.summaryMeta}>Data de envio: {whenOption === 'later' ? whenLabel : 'Agora'}</Text>
          <Text style={styles.summaryMeta}>
            Destinatário: {recipient.name} • {recipient.phone}
          </Text>
          {recipient.instructions ? (
            <Text style={styles.summaryMeta}>Observações: {recipient.instructions}</Text>
          ) : null}
        </View>

        <PaymentMethodSection
          amountCents={amountCents}
          selectedMethod={selectedPaymentMethod}
          onSelectMethod={setSelectedPaymentMethod}
          onConfirmPayment={handleConfirmPayment}
          confirmLabel="Confirmar envio"
          cancellationPolicyVariant={cancellationVariant}
          loading={submitting}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 },
  backButton: { marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.black, flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 32 },
  summaryCard: {
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryFeeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  summaryLabel: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  summaryPrice: { fontSize: 18, fontWeight: '700', color: COLORS.black },
  summaryMetaNote: { fontSize: 12, color: COLORS.neutral700, marginBottom: 4 },
  summaryDynamicPriceNote: { fontSize: 12, color: COLORS.neutral700, marginBottom: 8, fontStyle: 'italic' },
  summarySpacer: { height: 8 },
  summaryLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  summaryText: { fontSize: 14, color: COLORS.black, flex: 1 },
  summaryMeta: { fontSize: 13, color: COLORS.neutral700, marginTop: 4 },
  primaryButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
