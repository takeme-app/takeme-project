import { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DependentShipmentStackParamList } from '../../navigation/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAppAlert } from '../../contexts/AppAlertContext';

type Props = NativeStackScreenProps<DependentShipmentStackParamList, 'DependentShipmentForm'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral700: '#767676',
};

type Dependent = { id: string; full_name: string; status: string };

function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

function applyPhoneMask(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 11);
  return formatPhoneDisplay(digits);
}

export function DependentShipmentFormScreen({ navigation }: Props) {
  const { showAlert } = useAppAlert();
  const [fullName, setFullName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [bagsCount, setBagsCount] = useState(0);
  const [instructions, setInstructions] = useState('');
  const [dependentId, setDependentId] = useState<string | undefined>(undefined);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [loadingDependents, setLoadingDependents] = useState(true);

  const loadDependents = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoadingDependents(false);
      return;
    }
    const { data } = await supabase
      .from('dependents')
      .select('id, full_name, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'validated'])
      .order('created_at', { ascending: false });
    setDependents(data ?? []);
    setLoadingDependents(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoadingDependents(true);
      loadDependents();
    }, [loadDependents])
  );

  const handleContactChange = (text: string) => setContactPhone(applyPhoneMask(text));

  const goToAddDependent = () => {
    navigation.navigate('AddDependent');
  };

  const selectDependent = (d: Dependent) => {
    setDependentId(d.id);
    setFullName(d.full_name);
  };

  const handleDefineTrip = () => {
    const name = fullName.trim();
    if (!name) {
      showAlert('Atenção', 'Informe o nome do dependente.');
      return;
    }
    const phoneDigits = contactPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      showAlert('Atenção', 'Preencha o contato com DDD e número (ex.: (00) 00000-0000).');
      return;
    }
    navigation.navigate('DefineDependentTrip', {
      fullName: name,
      contactPhone: phoneDigits,
      bagsCount,
      instructions: instructions.trim() || undefined,
      dependentId,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navbarButton} onPress={() => navigation.getParent()?.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.navbarTitle} numberOfLines={1}>Envio de dependentes</Text>
      </View>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Confirme os detalhes do envio para seu dependente</Text>

          <Text style={styles.label}>Nome completo</Text>
          <View style={styles.nameRow}>
            <TextInput
              style={[styles.input, styles.nameInput]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Nome do dependente"
              placeholderTextColor={COLORS.neutral700}
            />
            <TouchableOpacity style={styles.linkButton} onPress={goToAddDependent} activeOpacity={0.8}>
              <Text style={styles.linkText}>Cadastrar contato</Text>
            </TouchableOpacity>
          </View>
          {!loadingDependents && dependents.length > 0 && (
            <View style={styles.dependentsRow}>
              {dependents.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.chip, dependentId === d.id && styles.chipSelected]}
                  onPress={() => selectDependent(d)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, dependentId === d.id && styles.chipTextSelected]} numberOfLines={1}>
                    {d.full_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>Contato</Text>
          <TextInput
            style={styles.input}
            value={contactPhone}
            onChangeText={handleContactChange}
            placeholder="(00) 00000-0000"
            placeholderTextColor={COLORS.neutral700}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Bagagens</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={[styles.stepperBtn, bagsCount <= 0 && styles.stepperBtnDisabled]}
              onPress={() => setBagsCount((c) => Math.max(0, c - 1))}
              disabled={bagsCount <= 0}
              activeOpacity={0.7}
            >
              <MaterialIcons name="remove" size={24} color={bagsCount <= 0 ? COLORS.neutral700 : COLORS.black} />
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{bagsCount} {bagsCount === 1 ? 'mala' : 'malas'}</Text>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => setBagsCount((c) => c + 1)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="add" size={24} color={COLORS.black} />
            </TouchableOpacity>
          </View>
          <Text style={styles.stepperHint}>Inclua quantas malas o dependente levará</Text>

          <View style={styles.optionalRow}>
            <Text style={styles.label}>Instruções para o entregador</Text>
            <Text style={styles.optional}>(Opcional)</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={instructions}
            onChangeText={setInstructions}
            placeholder="Ex: entregar direto ao portão de embarque."
            placeholderTextColor={COLORS.neutral700}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity style={styles.primaryButton} onPress={handleDefineTrip} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>Definir viagem</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
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
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.black, marginBottom: 20 },
  label: { fontSize: 15, fontWeight: '500', color: COLORS.black, marginBottom: 8 },
  optionalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  optional: { fontSize: 13, color: COLORS.neutral700 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  nameInput: { flex: 1 },
  input: {
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.black,
    marginBottom: 20,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  linkButton: { paddingVertical: 8 },
  linkText: { fontSize: 15, color: COLORS.black, fontWeight: '600', textDecorationLine: 'underline' },
  dependentsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: COLORS.neutral300,
  },
  chipSelected: { backgroundColor: COLORS.black },
  chipText: { fontSize: 14, color: COLORS.black },
  chipTextSelected: { color: '#FFF' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4 },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: { opacity: 0.5 },
  stepperValue: { fontSize: 16, fontWeight: '600', color: COLORS.black, minWidth: 80, textAlign: 'center' },
  stepperHint: { fontSize: 13, color: COLORS.neutral700, marginBottom: 20 },
  primaryButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
