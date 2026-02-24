import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TripStackParamList, 'Checkout'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
  orange: '#EA580C',
};

const DEFAULT_REGION = {
  latitude: -23.5505,
  longitude: -46.6333,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

type PaymentMethod = 'credit' | 'debit' | 'pix' | 'cash';

export function CheckoutScreen({ navigation }: Props) {
  const [payment, setPayment] = useState<PaymentMethod>('credit');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.mapWrap}>
        <MapView style={styles.map} initialRegion={DEFAULT_REGION} scrollEnabled={false} />
      </View>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Checkout</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Motorista</Text>
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar} />
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>Carlos Silva</Text>
              <Text style={styles.driverRating}>★ 4.8</Text>
            </View>
            <Text style={styles.fare}>R$ 64,00</Text>
          </View>
          <Text style={styles.meta}>Saída 14:00 · Chegada 16:30</Text>
          <View style={styles.metaRow}>
            <MaterialIcons name="directions-car" size={18} color={COLORS.neutral700} />
            <Text style={styles.metaText}>Argo Sedan • Placa RIO 2877</Text>
          </View>
          <View style={styles.metaRow}>
            <MaterialIcons name="work-outline" size={18} color={COLORS.neutral700} />
            <Text style={styles.metaText}>3 malas</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Passageiros</Text>
          <View style={styles.passengerRow}>
            <MaterialIcons name="person-outline" size={20} color={COLORS.neutral700} />
            <Text style={styles.passengerText}>João Silva · CPF: 123.456.789-00</Text>
          </View>
          <View style={styles.passengerRow}>
            <MaterialIcons name="person-outline" size={20} color={COLORS.neutral700} />
            <Text style={styles.passengerText}>Maria Santos · CPF: 987.654.321-00</Text>
          </View>
          <Text style={styles.bagsNote}>2 malas adicionadas</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Método de pagamento</Text>
          {(
            [
              { id: 'credit' as const, label: 'Cartão de crédito', icon: 'credit-card' as const },
              { id: 'debit' as const, label: 'Cartão de débito', icon: 'credit-card' as const },
              { id: 'pix' as const, label: 'Pix', icon: 'qr-code' as const },
              { id: 'cash' as const, label: 'Dinheiro', icon: 'payments' as const },
            ] as const
          ).map(({ id, label, icon }) => (
            <TouchableOpacity
              key={id}
              style={styles.paymentRow}
              onPress={() => setPayment(id)}
              activeOpacity={0.7}
            >
              <MaterialIcons name={icon} size={22} color={COLORS.black} />
              <Text style={styles.paymentLabel}>{label}</Text>
              <View style={[styles.radio, payment === id && styles.radioSelected]}>
                {payment === id && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}

          {payment === 'credit' && (
            <View style={styles.paymentForm}>
              <Text style={styles.paymentFormTitle}>Dados do cartão</Text>
              <TextInput style={styles.input} placeholder="Nome do cartão" placeholderTextColor={COLORS.neutral700} />
              <TextInput style={styles.input} placeholder="Número do cartão" placeholderTextColor={COLORS.neutral700} keyboardType="number-pad" />
              <View style={styles.row}>
                <TextInput style={[styles.input, styles.half]} placeholder="Validade" placeholderTextColor={COLORS.neutral700} />
                <TextInput style={[styles.input, styles.half]} placeholder="CVV" placeholderTextColor={COLORS.neutral700} keyboardType="number-pad" />
              </View>
              <TextInput style={styles.input} placeholder="CPF/CNPJ" placeholderTextColor={COLORS.neutral700} keyboardType="number-pad" />
            </View>
          )}
          {payment === 'cash' && (
            <Text style={styles.cashNote}>
              O pagamento deverá ser realizado diretamente ao motorista no momento do embarque. Você receberá o comprovante digital assim que o pagamento for registrado no sistema.
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.confirmButton}
          onPress={() => navigation.navigate('PaymentConfirmed')}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmButtonText}>Confirmar pagamento</Text>
        </TouchableOpacity>
        <View style={styles.policy}>
          <Text style={styles.policyText}>Cancelamento até 12h antes: reembolso integral</Text>
          <Text style={styles.policyText}>Reagendamento permitido até 2h antes</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  mapWrap: { height: 180, width: '100%' },
  map: { width: '100%', height: '100%' },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 48,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backArrow: { fontSize: 22, color: COLORS.black, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 32 },
  screenTitle: { fontSize: 22, fontWeight: '700', color: COLORS.black, marginBottom: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.neutral300,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.black, marginBottom: 12 },
  driverRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.neutral300, marginRight: 12 },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  driverRating: { fontSize: 14, color: COLORS.neutral700 },
  fare: { fontSize: 18, fontWeight: '700', color: COLORS.orange },
  meta: { fontSize: 13, color: COLORS.neutral700, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  metaText: { fontSize: 13, color: COLORS.neutral700 },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  passengerText: { flex: 1, fontSize: 14, color: COLORS.black },
  bagsNote: { fontSize: 13, color: COLORS.neutral700, marginTop: 4 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  paymentLabel: { flex: 1, fontSize: 16, fontWeight: '500', color: COLORS.black },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.neutral400, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: COLORS.black },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.black },
  paymentForm: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.neutral300, gap: 12 },
  paymentFormTitle: { fontSize: 14, fontWeight: '600', color: COLORS.black },
  input: { borderWidth: 1, borderColor: COLORS.neutral400, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: COLORS.black },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  cashNote: { fontSize: 13, color: COLORS.neutral700, marginTop: 8 },
  confirmButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  confirmButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  policy: { gap: 4 },
  policyText: { fontSize: 13, color: COLORS.neutral700 },
});
