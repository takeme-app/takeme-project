import { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Clipboard,
  Platform,
  Alert,
} from 'react-native';
import { Text } from './Text';
import { MaterialIcons } from '@expo/vector-icons';
import { CardField, useStripe } from '../lib/stripeNativeBridge';
import { useAppAlert } from '../contexts/AppAlertContext';
import { getUserErrorMessage } from '../utils/errorMessage';
import { formatCpf, onlyDigits, validateCpf } from '../utils/formatCpf';

export type PaymentMethodType = 'credito' | 'debito' | 'pix' | 'dinheiro';

export type CancellationPolicyVariant = 'trip' | 'shipment_credit' | 'shipment_debit';

export type PaymentMethodSectionProps = {
  amountCents: number;
  selectedMethod: PaymentMethodType | null;
  onSelectMethod: (method: PaymentMethodType) => void;
  onConfirmPayment: (params: { method: PaymentMethodType; paymentMethodId?: string }) => void | Promise<void>;
  confirmLabel: string;
  cancellationPolicyVariant: CancellationPolicyVariant;
  loading?: boolean;
};

const PAYMENT_OPTIONS: { type: PaymentMethodType; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { type: 'credito', label: 'Cartão de crédito', icon: 'credit-card' },
  { type: 'debito', label: 'Cartão de débito', icon: 'credit-card' },
  { type: 'pix', label: 'Pix', icon: 'qr-code-2' },
  { type: 'dinheiro', label: 'Dinheiro', icon: 'payments' },
];

function getCancellationPolicyLines(variant: CancellationPolicyVariant): string[] {
  switch (variant) {
    case 'shipment_credit':
      return [
        'Cancelamento até 2h antes: reembolso integral',
        'Cancelamento após 12h antes: sem reembolso',
        'Reagendamento permitido até 2h antes',
      ];
    case 'shipment_debit':
    case 'trip':
    default:
      return [
        'Cancelamento até 12h antes: reembolso integral',
        'Cancelamento após 12h antes: sem reembolso',
        'Reagendamento permitido até 2h antes',
      ];
  }
}

export function PaymentMethodSection({
  amountCents,
  selectedMethod,
  onSelectMethod,
  onConfirmPayment,
  confirmLabel,
  cancellationPolicyVariant,
  loading = false,
}: PaymentMethodSectionProps) {
  const { createPaymentMethod } = useStripe();
  const { showAlert } = useAppAlert();
  const [cardName, setCardName] = useState('');
  const [cardComplete, setCardComplete] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [pixResendCooldown, setPixResendCooldown] = useState(0);

  const amountFormatted = `R$ ${(amountCents / 100).toFixed(2).replace('.', ',')}`;

  const handleCpfChange = useCallback((text: string) => setCpfCnpj(formatCpf(text)), []);

  const handleConfirmCard = useCallback(async () => {
    if (selectedMethod !== 'credito' && selectedMethod !== 'debito') return;
    if (!cardName.trim()) {
      showAlert('Atenção', 'Preencha o nome do cartão.');
      return;
    }
    if (!cardComplete) {
      showAlert('Atenção', 'Preencha os dados do cartão (número, validade e CVV).');
      return;
    }
    const cpfDigits = onlyDigits(cpfCnpj);
    if (!cpfDigits) {
      showAlert('Atenção', 'Preencha o CPF.');
      return;
    }
    if (!validateCpf(cpfDigits)) {
      showAlert('CPF inválido', 'O CPF informado não é válido. Verifique e tente novamente.');
      return;
    }
    setConfirming(true);
    try {
      const { paymentMethod, error } = await createPaymentMethod({
        paymentMethodType: 'Card',
        paymentMethodData: {
          billingDetails: cardName.trim() ? { name: cardName.trim() } : undefined,
        },
      });
      if (error) {
        showAlert('Erro', getUserErrorMessage(error, 'Falha ao processar o cartão.'));
        return;
      }
      if (!paymentMethod?.id) {
        showAlert('Erro', 'Não foi possível obter o método de pagamento.');
        return;
      }
      await onConfirmPayment({ method: selectedMethod, paymentMethodId: paymentMethod.id });
    } finally {
      setConfirming(false);
    }
  }, [selectedMethod, cardName, cardComplete, cpfCnpj, createPaymentMethod, onConfirmPayment, showAlert]);

  const handleConfirmPix = useCallback(() => {
    onConfirmPayment({ method: 'pix' });
  }, [onConfirmPayment]);

  const handleConfirmDinheiro = useCallback(() => {
    onConfirmPayment({ method: 'dinheiro' });
  }, [onConfirmPayment]);

  const handleCopyPixCode = useCallback(() => {
    const code = '00190500954014481606'; // placeholder
    Clipboard.setString(code);
    if (Platform.OS === 'ios') Alert.alert('Copiado', 'Código Pix copiado.');
    else showAlert('Copiado', 'Código Pix copiado para a área de transferência.');
  }, [showAlert]);

  const handleResendPixEmail = useCallback(() => {
    if (pixResendCooldown > 0) return;
    setPixResendCooldown(60);
    const interval = setInterval(() => {
      setPixResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [pixResendCooldown]);

  const policyLines = getCancellationPolicyLines(
    selectedMethod === 'credito' ? 'shipment_credit' : selectedMethod === 'debito' ? 'shipment_debit' : cancellationPolicyVariant
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Método de pagamento</Text>

      {PAYMENT_OPTIONS.map((opt) => (
        <View key={opt.type} style={[styles.optionCard, selectedMethod === opt.type && styles.optionCardSelected]}>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => onSelectMethod(opt.type)}
            activeOpacity={0.8}
          >
            <MaterialIcons name={opt.icon} size={24} color={COLORS.black} style={styles.optionIcon} />
            <Text style={styles.optionLabel}>{opt.label}</Text>
            <View style={[styles.radio, selectedMethod === opt.type && styles.radioSelected]}>
              {selectedMethod === opt.type && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

          {selectedMethod === opt.type && opt.type === 'credito' && (
            <View style={styles.expanded}>
              <Text style={styles.formLabel}>Método de pagamento</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>Cartão de crédito</Text>
              </View>
              <Text style={styles.formLabel}>Número de parcelas</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>1x de {amountFormatted} (parcela única)</Text>
              </View>
              <Text style={styles.formLabel}>Dados do cartão</Text>
              <Text style={styles.formLabelSmall}>Nome do cartão</Text>
              <TextInput
                style={styles.input}
                placeholder="Nome como está no cartão"
                placeholderTextColor={COLORS.neutral700}
                value={cardName}
                onChangeText={setCardName}
                autoCapitalize="words"
              />
              <CardField
                postalCodeEnabled={false}
                onCardChange={(d) => setCardComplete(d.complete)}
                style={styles.cardField}
                cardStyle={CARD_STYLE}
              />
              <Text style={styles.formLabelSmall}>CPF</Text>
              <TextInput
                style={styles.input}
                placeholder="000.000.000-00"
                placeholderTextColor={COLORS.neutral700}
                value={cpfCnpj}
                onChangeText={handleCpfChange}
                keyboardType="number-pad"
                maxLength={14}
              />
              <TouchableOpacity
                style={[styles.confirmButton, (!cardComplete || loading || confirming) && styles.confirmButtonDisabled]}
                onPress={handleConfirmCard}
                disabled={!cardComplete || loading || confirming}
                activeOpacity={0.8}
              >
                {confirming ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmButtonText}>{confirmLabel}</Text>}
              </TouchableOpacity>
              <Text style={styles.policyTitle}>Política de Cancelamento</Text>
              {policyLines.map((line, i) => (
                <Text key={i} style={styles.policyItem}>• {line}</Text>
              ))}
            </View>
          )}

          {selectedMethod === opt.type && opt.type === 'debito' && (
            <View style={styles.expanded}>
              <Text style={styles.formLabel}>Método de pagamento</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>Cartão de débito</Text>
              </View>
              <Text style={styles.formLabel}>Dados do cartão</Text>
              <Text style={styles.formLabelSmall}>Nome do cartão</Text>
              <TextInput
                style={styles.input}
                placeholder="Nome como está no cartão"
                placeholderTextColor={COLORS.neutral700}
                value={cardName}
                onChangeText={setCardName}
                autoCapitalize="words"
              />
              <CardField
                postalCodeEnabled={false}
                onCardChange={(d) => setCardComplete(d.complete)}
                style={styles.cardField}
                cardStyle={CARD_STYLE}
              />
              <Text style={styles.formLabelSmall}>CPF</Text>
              <TextInput
                style={styles.input}
                placeholder="000.000.000-00"
                placeholderTextColor={COLORS.neutral700}
                value={cpfCnpj}
                onChangeText={handleCpfChange}
                keyboardType="number-pad"
                maxLength={14}
              />
              <TouchableOpacity
                style={[styles.confirmButton, (!cardComplete || loading || confirming) && styles.confirmButtonDisabled]}
                onPress={handleConfirmCard}
                disabled={!cardComplete || loading || confirming}
                activeOpacity={0.8}
              >
                {confirming ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmButtonText}>{confirmLabel}</Text>}
              </TouchableOpacity>
              <Text style={styles.policyTitle}>Política de Cancelamento</Text>
              {policyLines.map((line, i) => (
                <Text key={i} style={styles.policyItem}>• {line}</Text>
              ))}
            </View>
          )}

          {selectedMethod === opt.type && opt.type === 'pix' && (
            <View style={styles.expanded}>
              <Text style={styles.pixStep}>1. Acesse o app do seu banco</Text>
              <Text style={styles.pixStep}>2. Escolha pagar com Pix</Text>
              <Text style={styles.pixStep}>3. Cole o seguinte código:</Text>
              <View style={styles.pixCodeRow}>
                <Text style={styles.pixCode} numberOfLines={1}>0019050 0954014 48160 6...</Text>
                <TouchableOpacity onPress={handleCopyPixCode} style={styles.copyButton} hitSlop={12}>
                  <MaterialIcons name="content-copy" size={22} color={COLORS.black} />
                </TouchableOpacity>
              </View>
              <View style={styles.pixQrPlaceholder}>
                <MaterialIcons name="qr-code-2" size={80} color={COLORS.neutral700} />
              </View>
              <TouchableOpacity
                style={[styles.resendButton, pixResendCooldown > 0 && styles.resendButtonDisabled]}
                onPress={handleResendPixEmail}
                disabled={pixResendCooldown > 0}
              >
                <Text style={styles.resendButtonText}>
                  {pixResendCooldown > 0 ? `Reenviar email (${pixResendCooldown}s)` : 'Reenviar email (60s)'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
                onPress={handleConfirmPix}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
              </TouchableOpacity>
            </View>
          )}

          {selectedMethod === opt.type && opt.type === 'dinheiro' && (
            <View style={styles.expanded}>
              <Text style={styles.dinheiroText}>
                O pagamento deverá ser realizado diretamente ao motorista no momento do embarque.
              </Text>
              <Text style={styles.dinheiroText}>
                Você receberá o comprovante digital assim que o pagamento for registrado no sistema.
              </Text>
              <TouchableOpacity
                style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
                onPress={handleConfirmDinheiro}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const COLORS = {
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

const CARD_STYLE = {
  backgroundColor: COLORS.neutral300,
  textColor: COLORS.black,
  placeholderColor: COLORS.neutral700,
  borderColor: COLORS.neutral400,
  borderWidth: 1,
  borderRadius: 12,
  fontSize: 16,
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 12,
  },
  optionCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    padding: 16,
    marginBottom: 12,
  },
  optionCardSelected: {
    borderColor: COLORS.black,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    marginRight: 12,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.neutral400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: COLORS.black,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.black,
  },
  expanded: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral400,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 8,
  },
  formLabelSmall: {
    fontSize: 14,
    color: COLORS.neutral700,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.neutral300,
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.black,
  },
  cardField: {
    width: '100%',
    height: 56,
    marginVertical: 8,
  },
  readOnlyField: {
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  readOnlyText: {
    fontSize: 16,
    color: COLORS.neutral700,
  },
  confirmButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  policyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.black,
    marginTop: 20,
    marginBottom: 8,
  },
  policyItem: {
    fontSize: 13,
    color: COLORS.neutral700,
    lineHeight: 20,
    marginBottom: 4,
  },
  pixStep: {
    fontSize: 14,
    color: COLORS.black,
    marginBottom: 6,
  },
  pixCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  pixCode: {
    flex: 1,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: COLORS.black,
  },
  copyButton: {
    padding: 8,
  },
  pixQrPlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  resendButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },
  dinheiroText: {
    fontSize: 14,
    color: COLORS.neutral700,
    lineHeight: 22,
    marginBottom: 12,
  },
});
