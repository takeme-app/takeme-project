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
import * as ImagePicker from 'expo-image-picker';

type Props = NativeStackScreenProps<DependentShipmentStackParamList, 'DependentShipmentForm'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral700: '#767676',
};

type Dependent = { id: string; full_name: string; status: string; contact_phone: string | null };

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
  const [contactPhone, setContactPhone] = useState('');
  const [bagsCount, setBagsCount] = useState(0);
  const [instructions, setInstructions] = useState('');
  const [selectedDependent, setSelectedDependent] = useState<Dependent | null>(null);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [loadingDependents, setLoadingDependents] = useState(true);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permissão', 'Precisamos de acesso à galeria para adicionar uma foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const loadDependents = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoadingDependents(false);
      return;
    }
    const { data } = await supabase
      .from('dependents')
      .select('id, full_name, status, contact_phone')
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
    if (d.status !== 'validated') return;
    setSelectedDependent(d);
    if (d.contact_phone) {
      setContactPhone(formatPhoneDisplay(d.contact_phone));
    }
  };

  const handleDefineTrip = () => {
    if (!selectedDependent) {
      showAlert('Atenção', 'Selecione um dependente aprovado para continuar.');
      return;
    }
    const phoneDigits = contactPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      showAlert('Atenção', 'Preencha o contato com DDD e número (ex.: (00) 00000-0000).');
      return;
    }
    navigation.navigate('DefineDependentTrip', {
      fullName: selectedDependent.full_name,
      contactPhone: phoneDigits,
      bagsCount,
      instructions: instructions.trim() || undefined,
      dependentId: selectedDependent.id,
      photoUri: photoUri ?? undefined,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navbarButton} onPress={() => navigation.getParent()?.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <View style={styles.navbarTitleWrap} pointerEvents="box-none">
          <Text style={styles.navbarTitle} numberOfLines={1}>Viagem de dependente</Text>
        </View>
      </View>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Confirme os detalhes da viagem do seu dependente</Text>

          <View style={styles.dependentHeader}>
            <Text style={styles.label}>Dependente</Text>
            <TouchableOpacity onPress={goToAddDependent} activeOpacity={0.8}>
              <Text style={styles.linkText}>+ Cadastrar novo</Text>
            </TouchableOpacity>
          </View>
          {loadingDependents ? (
            <Text style={styles.loadingText}>Carregando dependentes...</Text>
          ) : dependents.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Nenhum dependente cadastrado.</Text>
              <TouchableOpacity onPress={goToAddDependent} activeOpacity={0.8}>
                <Text style={styles.emptyLink}>Cadastrar dependente</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.dependentsList}>
              {dependents.map((d) => {
                const isValidated = d.status === 'validated';
                const isSelected = selectedDependent?.id === d.id;
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[
                      styles.dependentCard,
                      isSelected && styles.dependentCardSelected,
                      !isValidated && styles.dependentCardDisabled,
                    ]}
                    onPress={() => selectDependent(d)}
                    disabled={!isValidated}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dependentCardContent}>
                      <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <Text
                        style={[
                          styles.dependentCardName,
                          !isValidated && styles.dependentCardNameDisabled,
                        ]}
                        numberOfLines={1}
                      >
                        {d.full_name}
                      </Text>
                    </View>
                    {isValidated ? (
                      <View style={styles.statusBadgeApproved}>
                        <Text style={styles.statusBadgeApprovedText}>Aprovado</Text>
                      </View>
                    ) : (
                      <View style={styles.statusBadgePending}>
                        <Text style={styles.statusBadgePendingText}>Aguardando aprovação</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
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

          <View style={styles.separator}>
            <View style={styles.separatorLine} />
          </View>
          <Text style={styles.bagagensLabel}>Bagagem</Text>
          <View style={styles.stepperWrap}>
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
            <Text style={styles.stepperHint}>Quantas malas o dependente levará na viagem</Text>
          </View>
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
          </View>

          <View style={styles.optionalRow}>
            <Text style={styles.label}>Instruções para o motorista</Text>
            <Text style={styles.optional}>(Opcional)</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={instructions}
            onChangeText={setInstructions}
            placeholder="Ex: buscar na portaria do condomínio."
            placeholderTextColor={COLORS.neutral700}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>Foto do dependente (opcional)</Text>
          <TouchableOpacity style={styles.photoBox} onPress={pickImage} activeOpacity={0.8}>
            {photoUri ? (
              <Text style={styles.photoPlaceholderText} numberOfLines={1}>Foto selecionada</Text>
            ) : (
              <>
                <MaterialIcons name="camera-alt" size={32} color={COLORS.neutral700} />
                <Text style={styles.photoPlaceholderText}>Toque para adicionar</Text>
              </>
            )}
          </TouchableOpacity>

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
  navbarTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navbarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navbarTitle: { fontSize: 14, fontWeight: '700', color: COLORS.black },
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 48 },
  separator: { paddingVertical: 40, marginHorizontal: -24 },
  separatorLine: { height: 1, backgroundColor: '#E2E2E2', width: '100%' },
  sectionTitle: { fontSize: 24, fontWeight: '600', color: COLORS.black, marginBottom: 20 },
  label: { fontSize: 15, fontWeight: '500', color: COLORS.black, marginBottom: 8 },
  bagagensLabel: { fontSize: 24, fontWeight: '600', color: COLORS.black, textAlign: 'center', marginBottom: 48 },
  optionalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  optional: { fontSize: 13, color: COLORS.neutral700 },
  dependentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  loadingText: { fontSize: 14, color: COLORS.neutral700, marginBottom: 16 },
  emptyState: {
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: { fontSize: 14, color: COLORS.neutral700, marginBottom: 12 },
  emptyLink: { fontSize: 14, fontWeight: '600', color: COLORS.black, textDecorationLine: 'underline' },
  dependentsList: { gap: 10, marginBottom: 16 },
  dependentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dependentCardSelected: { borderColor: COLORS.black },
  dependentCardDisabled: { opacity: 0.55 },
  dependentCardContent: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.neutral700,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioOuterSelected: { borderColor: COLORS.black },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.black },
  dependentCardName: { fontSize: 16, fontWeight: '500', color: COLORS.black, flexShrink: 1 },
  dependentCardNameDisabled: { color: COLORS.neutral700 },
  statusBadgeApproved: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusBadgeApprovedText: { fontSize: 11, fontWeight: '600', color: '#2E7D32' },
  statusBadgePending: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusBadgePendingText: { fontSize: 11, fontWeight: '600', color: '#E65100' },
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
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.black,
    textDecorationLine: 'underline',
  },
  stepperWrap: { marginBottom: 20 },
  stepperRow: {
    flexDirection: 'row',
    width: 358,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: { opacity: 0.5 },
  stepperValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0D0D0D',
    textAlign: 'center',
  },
  stepperHint: { fontSize: 13, color: COLORS.neutral700, textAlign: 'center' },
  photoBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E2E2E2',
    borderRadius: 12,
    minHeight: 120,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 24,
  },
  photoPlaceholderText: { fontSize: 14, color: COLORS.neutral700, marginTop: 4 },
  primaryButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
