import { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from '../../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripStackParamList, TripPassengerParam } from '../../navigation/types';
import { formatCpf, onlyDigits, validateCpf } from '../../utils/formatCpf';
import { useAppAlert } from '../../contexts/AppAlertContext';
import { supabase } from '../../lib/supabase';
import { calendarDayKeySaoPaulo, getDuplicateDestinationSameDayMessage } from '../../lib/sameDestinationSameDayGuard';

type Props = NativeStackScreenProps<TripStackParamList, 'ConfirmDetails'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

export function ConfirmDetailsScreen({ navigation, route }: Props) {
  const { showAlert } = useAppAlert();
  const driver = route.params?.driver;
  const origin = route.params?.origin;
  const destination = route.params?.destination;
  const [bags, setBags] = useState(2);
  /** Passageiros *adicionais* (o solicitante já conta como 1 lugar). */
  const [extraPassengers, setExtraPassengers] = useState(0);
  const [passengerData, setPassengerData] = useState<Record<number, { name: string; cpf: string }>>({});
  const [confirmBusy, setConfirmBusy] = useState(false);

  const updatePassenger = (index: number, field: 'name' | 'cpf', value: string) => {
    setPassengerData((prev) => ({
      ...prev,
      [index]: { ...(prev[index] ?? { name: '', cpf: '' }), [field]: value },
    }));
  };

  const goToCheckout = useCallback(async () => {
    if (!driver || !destination) return;
    setConfirmBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showAlert('Sessão', 'Faça login para continuar.');
        return;
      }
      let depIso = route.params?.scheduledTripDepartureAt ?? null;
      const tripId = route.params?.scheduled_trip_id;
      if (!depIso && tripId) {
        const { data: stRow } = await supabase
          .from('scheduled_trips')
          .select('departure_at')
          .eq('id', tripId)
          .maybeSingle();
        depIso = (stRow?.departure_at as string | undefined) ?? null;
      }
      if (depIso) {
        const dupMsg = await getDuplicateDestinationSameDayMessage({
          userId: user.id,
          destLat: destination.latitude,
          destLng: destination.longitude,
          dayKey: calendarDayKeySaoPaulo(depIso),
        });
        if (dupMsg) {
          showAlert('Limite', dupMsg);
          return;
        }
      }
      const passengerList: TripPassengerParam[] = Array.from({ length: extraPassengers }, (_, i) => ({
        name: passengerData[i]?.name ?? '',
        cpf: passengerData[i]?.cpf ?? '',
        bags: '',
      }));
      navigation.navigate('Checkout', {
        driver,
        origin,
        destination,
        scheduled_trip_id: route.params?.scheduled_trip_id,
        passengers: passengerList,
        bags_count: bags,
        immediateTrip: route.params?.immediateTrip,
        scheduledTripDepartureAt: route.params?.scheduledTripDepartureAt,
      });
    } finally {
      setConfirmBusy(false);
    }
  }, [
    bags,
    destination,
    driver,
    extraPassengers,
    navigation,
    origin,
    passengerData,
    route.params?.immediateTrip,
    route.params?.scheduledTripDepartureAt,
    route.params?.scheduled_trip_id,
    showAlert,
  ]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
        <Text style={styles.title}>Confirme os detalhes da sua viagem</Text>

        <Text style={styles.sectionLabel}>Quantas malas você vai levar?</Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => setBags((b) => Math.max(0, b - 1))}
            activeOpacity={0.8}
          >
            <Text style={styles.stepperSymbol}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{bags} malas</Text>
          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => setBags((b) => b + 1)}
            activeOpacity={0.8}
          >
            <Text style={styles.stepperSymbol}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>Inclua quantas malas serão levadas</Text>

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Quantos passageiros extras vão com você?</Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => setExtraPassengers((p) => Math.max(0, p - 1))}
            activeOpacity={0.8}
          >
            <Text style={styles.stepperSymbol}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepperValue}>
            {extraPassengers === 0
              ? 'Nenhum'
              : extraPassengers === 1
                ? '1 passageiro extra'
                : `${extraPassengers} passageiros extras`}
          </Text>
          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => setExtraPassengers((p) => p + 1)}
            activeOpacity={0.8}
          >
            <Text style={styles.stepperSymbol}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          Você já conta como passageiro principal; inclua aqui só quem viaja com você (nome e CPF).
        </Text>

        {Array.from({ length: extraPassengers }, (_, i) => (
          <View key={i} style={styles.passengerBlock}>
            <Text style={styles.passengerTitle}>Dados do passageiro adicional {i + 1}</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome do passageiro"
              placeholderTextColor={COLORS.neutral700}
              value={passengerData[i]?.name ?? ''}
              onChangeText={(v) => updatePassenger(i, 'name', v)}
            />
            <TextInput
              style={styles.input}
              placeholder="CPF do passageiro (000.000.000-00)"
              placeholderTextColor={COLORS.neutral700}
              value={passengerData[i]?.cpf ?? ''}
              onChangeText={(v) => updatePassenger(i, 'cpf', formatCpf(v))}
              keyboardType="number-pad"
              maxLength={14}
            />
          </View>
        ))}

        <TouchableOpacity
          style={[styles.confirmButton, confirmBusy && styles.confirmButtonDisabled]}
          disabled={confirmBusy}
          onPress={() => {
            for (let i = 0; i < extraPassengers; i++) {
              const cpfRaw = passengerData[i]?.cpf ?? '';
              const cpfDigits = onlyDigits(cpfRaw);
              if (cpfDigits && !validateCpf(cpfDigits)) {
                showAlert('CPF inválido', `O CPF do passageiro adicional ${i + 1} não é válido. Verifique e tente novamente.`);
                return;
              }
            }
            void goToCheckout();
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmButtonText}>{confirmBusy ? 'Verificando…' : 'Confirmar viagem'}</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 16,
  },
  backArrow: { fontSize: 22, color: COLORS.black, fontWeight: '600' },
  keyboardAvoid: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 120 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.black, marginBottom: 24 },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: COLORS.black, marginBottom: 12 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSymbol: { fontSize: 22, fontWeight: '600', color: COLORS.black },
  stepperValue: { fontSize: 20, fontWeight: '700', color: COLORS.black, flex: 1, textAlign: 'center' },
  hint: { fontSize: 13, color: COLORS.neutral700, marginTop: 8 },
  passengerBlock: { marginTop: 24, gap: 12 },
  passengerTitle: { fontSize: 16, fontWeight: '600', color: COLORS.black, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.black,
  },
  confirmButtonDisabled: { opacity: 0.65 },
  confirmButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 32,
  },
  confirmButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
