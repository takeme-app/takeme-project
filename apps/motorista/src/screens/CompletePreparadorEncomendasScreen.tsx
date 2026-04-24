import { useEffect, useState, type ReactNode } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { Text } from '../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppAlert } from '../contexts/AppAlertContext';
import { supabase } from '../lib/supabase';
import { resolveWorkerBaseId } from '../lib/resolveWorkerBaseId';
import { getGoogleMapsApiKey } from '../lib/googleMapsConfig';
import { GoogleCityAutocomplete } from '../components/GoogleCityAutocomplete';
import type { GoogleGeocodeResult } from '@take-me/shared';
import { formatCpf, onlyDigits, validateCpf } from '../utils/formatCpf';
import { formatPhoneBR } from '../utils/formatPhone';
import { OnboardingStepHeader } from '../components/OnboardingStepHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'CompletePreparadorEncomendas'>;

const BUCKET = 'driver-documents';

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function CompletePreparadorEncomendasScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [age, setAge] = useState('');
  const [city, setCity] = useState('');
  const [cityResolved, setCityResolved] = useState(false);
  const [cityMeta, setCityMeta] = useState<{ locality: string | null; adminArea: string | null }>({
    locality: null,
    adminArea: null,
  });
  const [experienceYears, setExperienceYears] = useState('');

  const [ownsVehicle, setOwnsVehicle] = useState(false);
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [vehiclePhone, setVehiclePhone] = useState('');
  const [vehicleCapacity, setVehicleCapacity] = useState('');
  const [vehicleDocUri, setVehicleDocUri] = useState<string | null>(null);
  const [vehiclePhotosUris, setVehiclePhotosUris] = useState<string[]>([]);

  const [identityDocUri, setIdentityDocUri] = useState<string | null>(null);
  const [willPresentCriminalRecord, setWillPresentCriminalRecord] = useState(false);
  const [criminalRecordUri, setCriminalRecordUri] = useState<string | null>(null);

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedNotifications, setAcceptedNotifications] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setSessionUserId(data.user?.id ?? null);
      setSessionReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const credentialsReady = Boolean(sessionUserId);

  const pickImage = async (callback: (uri: string) => void) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { showAlert('Permissão', 'É necessário permitir acesso às fotos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8, base64: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      callback(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
    }
  };

  const pickMultipleImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { showAlert('Permissão', 'É necessário permitir acesso às fotos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8, base64: true });
    if (!result.canceled && result.assets.length)
      setVehiclePhotosUris((prev) => [...prev, ...result.assets.map((a) => a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri)]);
  };

  const sectionTitle = (title: string) => <Text style={styles.sectionTitle}>{title}</Text>;

  const validateAndSubmit = async () => {
    if (!sessionUserId) { showAlert('Sessão expirada', 'Faça login novamente para concluir o cadastro.'); return; }
    if (!fullName.trim()) { showAlert('Atenção', 'Preencha o nome completo.'); return; }
    const cpfDigits = onlyDigits(cpf);
    if (cpfDigits.length !== 11 || !validateCpf(cpf)) { showAlert('CPF inválido', 'Informe um CPF válido.'); return; }
    const ageNum = parseInt(onlyDigits(age), 10);
    if (!ageNum || ageNum < 18 || ageNum > 100) { showAlert('Atenção', 'Informe uma idade válida (18–100).'); return; }
    if (!city.trim()) { showAlert('Atenção', 'Preencha a cidade.'); return; }
    const mapsKeyCity = getGoogleMapsApiKey()?.trim();
    if (mapsKeyCity) {
      if (!cityResolved) {
        showAlert(
          'Atenção',
          'Cidade: toque numa opção da lista até aparecer o ícone verde de confirmação ao lado do campo.',
        );
        return;
      }
    } else if (!cityResolved) {
      showAlert(
        'Atenção',
        'Cidade: informe ao menos 2 caracteres ou configure EXPO_PUBLIC_GOOGLE_MAPS_API_KEY para buscar e confirmar na lista.',
      );
      return;
    }
    const expNum = parseInt(onlyDigits(experienceYears), 10);
    if (!expNum || expNum < 1 || expNum > 60) { showAlert('Atenção', 'Informe os anos de experiência (1–60).'); return; }
    if (ownsVehicle) {
      if (!vehicleYear.trim() || onlyDigits(vehicleYear).length !== 4) { showAlert('Atenção', 'Informe o ano do veículo.'); return; }
      if (!vehicleModel.trim()) { showAlert('Atenção', 'Preencha o modelo do veículo.'); return; }
      if (!licensePlate.trim()) { showAlert('Atenção', 'Preencha a placa do veículo.'); return; }
      const phoneDigits = onlyDigits(vehiclePhone);
      if (phoneDigits.length < 10) { showAlert('Atenção', 'Informe um telefone válido com DDD.'); return; }
      if (!vehicleCapacity.trim()) { showAlert('Atenção', 'Preencha a capacidade do veículo.'); return; }
      if (!vehicleDocUri) { showAlert('Atenção', 'Envie o documento do veículo.'); return; }
      if (vehiclePhotosUris.length < 2) { showAlert('Atenção', 'Envie ao menos 2 fotos do veículo.'); return; }
    }
    if (!identityDocUri) { showAlert('Atenção', 'Envie o documento de identidade.'); return; }
    if (willPresentCriminalRecord && !criminalRecordUri) { showAlert('Atenção', 'Envie o documento de antecedentes ou desmarque a opção.'); return; }
    if (!acceptedTerms) { showAlert('Atenção', 'Aceite os Termos de Uso e a Política de Privacidade.'); return; }

    setLoading(true);
    try {
      const userId = sessionUserId;
      const nowIso = new Date().toISOString();

      const uploadDoc = async (uri: string, path: string): Promise<string> => {
        const base64 = uri.startsWith('data:') ? uri.split(',')[1] ?? '' : null;
        if (!base64) throw new Error('Documento inválido. Selecione a imagem novamente.');
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const { data, error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
        if (error) throw new Error(error.message || 'Falha ao enviar documento.');
        return data.path;
      };

      const identityPath = await uploadDoc(identityDocUri, `${userId}/identity_doc.jpg`);
      let criminalPath: string | null = null;
      if (willPresentCriminalRecord && criminalRecordUri)
        criminalPath = await uploadDoc(criminalRecordUri, `${userId}/criminal_record.jpg`);

      let vehicleDocPath: string | null = null;
      if (ownsVehicle && vehicleDocUri)
        vehicleDocPath = await uploadDoc(vehicleDocUri, `${userId}/vehicle_doc.jpg`);

      await supabase.from('profiles').update({ full_name: fullName.trim(), cpf: cpfDigits, city: city.trim(), updated_at: nowIso }).eq('id', userId);

      const baseId = await resolveWorkerBaseId(cityMeta.locality, cityMeta.adminArea, city.trim());

      const workerPayload = {
        role: 'preparer' as const,
        subtype: 'shipments' as const,
        status: 'inactive' as const,
        cpf: cpfDigits,
        age: ageNum,
        city: city.trim(),
        experience_years: expNum,
        has_own_vehicle: ownsVehicle,
        cnh_document_url: identityPath,
        background_check_url: criminalPath ?? vehicleDocPath,
        base_id: baseId,
        updated_at: nowIso,
      };

      const { data: existing } = await supabase
        .from('worker_profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (existing?.id) {
        const { error: upErr } = await supabase
          .from('worker_profiles')
          .update(workerPayload)
          .eq('id', userId);
        if (upErr) throw new Error(upErr.message || 'Falha ao atualizar perfil.');
      } else {
        const { error: insErr } = await supabase
          .from('worker_profiles')
          .insert({ id: userId, ...workerPayload, created_at: nowIso });
        if (insErr) throw new Error(insErr.message || 'Falha ao salvar perfil.');
      }

      if (ownsVehicle) {
        const yr = parseInt(onlyDigits(vehicleYear), 10);
        const cap = parseInt(onlyDigits(vehicleCapacity), 10);
        await supabase.from('vehicles').insert({
          worker_id: userId, year: yr, model: vehicleModel.trim(),
          plate: licensePlate.trim().toUpperCase(), passenger_capacity: cap,
          status: 'pending', is_active: true,
        });
      }

      try {
        const { tryOpenSupportTicket } = await import('../lib/supportTickets');
        void tryOpenSupportTicket('cadastro_transporte', { worker_id: userId });
      } catch {
        /* ignore */
      }

      navigation.reset({
        index: 0,
        routes: [{ name: 'StripeConnectSetup', params: { subtype: 'shipments' } }],
      });
    } catch (err: unknown) {
      showAlert('Erro', err instanceof Error ? err.message : 'Erro ao enviar cadastro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
              return;
            }
            Alert.alert(
              'Sair do cadastro?',
              'Você perderá o progresso desta etapa e voltará para a tela inicial. Você poderá retomar depois entrando com a sua conta.',
              [
                { text: 'Continuar cadastro', style: 'cancel' },
                {
                  text: 'Sair',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await supabase.auth.signOut();
                    } catch (err) {
                      console.warn('[CompletePreparadorEncomendas] signOut:', err);
                    }
                    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
                  },
                },
              ],
            );
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete seu cadastro</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <OnboardingStepHeader
          current={2}
          title="Complete seu perfil"
          subtitle="Preencha suas informações para que possamos validar seu perfil como preparador de encomendas."
        />

        {sectionTitle('Dados básicos')}
        <FieldBlock label="Nome completo">
          <TextInput style={styles.input} placeholder="Digite seu nome completo" placeholderTextColor="#9CA3AF" value={fullName} onChangeText={setFullName} />
        </FieldBlock>
        <FieldBlock label="CPF">
          <TextInput style={styles.input} placeholder="Ex: 123.456.789-00" placeholderTextColor="#9CA3AF" value={cpf} onChangeText={(t) => setCpf(formatCpf(t))} keyboardType="number-pad" maxLength={14} />
        </FieldBlock>
        <FieldBlock label="Idade">
          <TextInput style={styles.input} placeholder="Ex: 30" placeholderTextColor="#9CA3AF" value={age} onChangeText={(t) => setAge(onlyDigits(t).slice(0, 3))} keyboardType="number-pad" maxLength={3} />
        </FieldBlock>
        <FieldBlock label="Cidade">
          <GoogleCityAutocomplete
            placeholder="Busque sua cidade (ex: São Luís)"
            value={city}
            onChangeText={setCity}
            onSelectPlace={(p: GoogleGeocodeResult) => {
              setCityMeta({ locality: p.locality, adminArea: p.adminAreaLevel1 });
            }}
            onResolutionChange={(resolved) => {
              setCityResolved(resolved);
              if (!resolved) setCityMeta({ locality: null, adminArea: null });
            }}
            cityConfirmed={cityResolved}
            inputStyle={styles.input}
          />
        </FieldBlock>
        <FieldBlock label="Anos de experiência com encomendas">
          <TextInput style={styles.input} placeholder="Ex: 3" placeholderTextColor="#9CA3AF" value={experienceYears} onChangeText={(t) => setExperienceYears(onlyDigits(t).slice(0, 2))} keyboardType="number-pad" maxLength={2} />
        </FieldBlock>

        {sectionTitle('Veículo de entrega')}
        <Text style={styles.questionLabel}>Possui veículo próprio?</Text>
        <View style={styles.radioRow}>
          {[true, false].map((val) => (
            <TouchableOpacity key={String(val)} style={styles.radioOption} onPress={() => setOwnsVehicle(val)} activeOpacity={0.7}>
              <View style={[styles.radio, ownsVehicle === val && styles.radioSelected]}>
                {ownsVehicle === val ? <View style={styles.radioInner} /> : null}
              </View>
              <Text style={styles.radioLabel}>{val ? 'Sim' : 'Não'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {ownsVehicle ? (
          <>
            <FieldBlock label="Ano do veículo">
              <TextInput style={styles.input} placeholder="Ex: 2020" placeholderTextColor="#9CA3AF" value={vehicleYear} onChangeText={(t) => setVehicleYear(onlyDigits(t).slice(0, 4))} keyboardType="number-pad" maxLength={4} />
            </FieldBlock>
            <FieldBlock label="Modelo">
              <TextInput style={styles.input} placeholder="Ex: Fiat Fiorino" placeholderTextColor="#9CA3AF" value={vehicleModel} onChangeText={setVehicleModel} />
            </FieldBlock>
            <FieldBlock label="Placa">
              <TextInput style={styles.input} placeholder="Ex: ABC1D23" placeholderTextColor="#9CA3AF" value={licensePlate} onChangeText={(t) => setLicensePlate(t.toUpperCase())} autoCapitalize="characters" maxLength={10} />
            </FieldBlock>
            <FieldBlock label="Telefone">
              <TextInput style={styles.input} placeholder="Ex: (11) 98765-4321" placeholderTextColor="#9CA3AF" value={vehiclePhone} onChangeText={(t) => setVehiclePhone(formatPhoneBR(t))} keyboardType="phone-pad" maxLength={16} />
            </FieldBlock>
            <FieldBlock label="Capacidade de carga (volumes)">
              <TextInput style={styles.input} placeholder="Ex: 20" placeholderTextColor="#9CA3AF" value={vehicleCapacity} onChangeText={(t) => setVehicleCapacity(onlyDigits(t).slice(0, 3))} keyboardType="number-pad" maxLength={3} />
            </FieldBlock>
            <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setVehicleDocUri)} activeOpacity={0.8}>
              <MaterialIcons name="cloud-upload" size={40} color="#9CA3AF" />
              <Text style={styles.uploadTitle}>Documento do veículo</Text>
              <Text style={styles.uploadSub}>Clique para fazer o upload</Text>
              {vehicleDocUri ? <Text style={styles.uploadOk}>✓ Adicionado</Text> : null}
            </TouchableOpacity>
            <Text style={styles.photosSectionTitle}>Fotos do veículo</Text>
            <Text style={styles.photosSectionHint}>Envie ao menos 2 fotos</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={pickMultipleImages} activeOpacity={0.8}>
              <MaterialIcons name="cloud-upload" size={40} color="#9CA3AF" />
              <Text style={styles.uploadSub}>Clique para fazer upload (múltiplas fotos)</Text>
              {vehiclePhotosUris.length > 0 ? <Text style={styles.uploadOk}>✓ {vehiclePhotosUris.length} foto(s)</Text> : null}
            </TouchableOpacity>
          </>
        ) : null}

        {sectionTitle('Documentos')}
        <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setIdentityDocUri)} activeOpacity={0.8}>
          <MaterialIcons name="cloud-upload" size={40} color="#9CA3AF" />
          <Text style={styles.uploadTitle}>Documento de identidade</Text>
          <Text style={styles.uploadSub}>Envie RG, CNH ou outro documento de identificação válido.</Text>
          {identityDocUri ? <Text style={styles.uploadOk}>✓ Documento adicionado</Text> : null}
        </TouchableOpacity>

        <View style={styles.checkboxRow}>
          <TouchableOpacity onPress={() => setWillPresentCriminalRecord((v) => !v)} activeOpacity={0.7} style={styles.checkboxHitArea}>
            <View style={[styles.checkbox, willPresentCriminalRecord && styles.checkboxChecked]}>
              {willPresentCriminalRecord ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.checkboxLabelWrap} onPress={() => setWillPresentCriminalRecord((v) => !v)} activeOpacity={0.7}>
            <Text style={styles.checkLabelStandalone}>Apresentar Antecedentes Criminais</Text>
          </TouchableOpacity>
        </View>
        {willPresentCriminalRecord ? (
          <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setCriminalRecordUri)} activeOpacity={0.8}>
            <MaterialIcons name="cloud-upload" size={40} color="#9CA3AF" />
            <Text style={styles.uploadSub}>Emitir documento no site da Polícia Federal. O arquivo deve ter sido emitido nos últimos 90 dias.</Text>
            {criminalRecordUri ? <Text style={styles.uploadOk}>✓ Documento adicionado</Text> : null}
          </TouchableOpacity>
        ) : null}

        <View style={styles.checksSection}>
          <View style={styles.checkboxRow}>
            <TouchableOpacity onPress={() => setAcceptedTerms((v) => !v)} activeOpacity={0.7} style={styles.checkboxHitArea}>
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
            </TouchableOpacity>
            <View style={styles.checkboxLabelWrap}>
              <Text style={styles.termsText}>
                Concordo com os{' '}
                <Text style={styles.linkInline} onPress={() => navigation.navigate('TermsOfUse')}>Termos de Uso</Text>
                {' '}e a{' '}
                <Text style={styles.linkInline} onPress={() => navigation.navigate('PrivacyPolicy')}>Política de Privacidade</Text>.
              </Text>
            </View>
          </View>
          <View style={styles.checkboxRow}>
            <TouchableOpacity onPress={() => setAcceptedNotifications((v) => !v)} activeOpacity={0.7} style={styles.checkboxHitArea}>
              <View style={[styles.checkbox, acceptedNotifications && styles.checkboxChecked]}>
                {acceptedNotifications ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.checkboxLabelWrap} onPress={() => setAcceptedNotifications((v) => !v)} activeOpacity={0.7}>
              <Text style={styles.checkLabelStandalone}>Aceito receber ofertas e comunicações do Take Me.</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.footerInScroll, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.nextStepHint}>
            Na próxima etapa você configura o recebimento automático via Stripe. Você poderá pular e configurar depois.
          </Text>
          <TouchableOpacity
            style={[styles.submitBtn, (!credentialsReady || !sessionReady || loading) && styles.submitBtnDisabled]}
            onPress={validateAndSubmit}
            activeOpacity={0.8}
            disabled={!credentialsReady || !sessionReady || loading}
          >
            <Text style={styles.submitBtnText}>{loading ? 'Salvando...' : 'Avançar'}</Text>
          </TouchableOpacity>
          {sessionReady && !credentialsReady ? (
            <Text style={styles.credentialsHint}>Sessão expirada. Faça login para continuar.</Text>
          ) : null}
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backToLogin}>
            <Text style={styles.backToLoginText}>Voltar para o login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#000' },
  headerRight: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8 },
  pageTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 8 },
  pageSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12, marginTop: 8 },
  fieldBlock: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '500', color: '#111827', marginBottom: 8 },
  questionLabel: { fontSize: 14, fontWeight: '500', color: '#111827', marginBottom: 10 },
  input: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#000' },
  radioRow: { flexDirection: 'row', gap: 28, marginBottom: 16 },
  radioOption: { flexDirection: 'row', alignItems: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  radioSelected: { borderColor: '#000' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#000' },
  radioLabel: { fontSize: 16, color: '#111827' },
  uploadBox: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#D1D5DB', borderRadius: 12, padding: 24, alignItems: 'center', marginBottom: 16 },
  uploadTitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginTop: 8 },
  uploadSub: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  uploadOk: { fontSize: 13, color: '#059669', marginTop: 6, fontWeight: '600' },
  photosSectionTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 4 },
  photosSectionHint: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  checksSection: { marginTop: 8, marginBottom: 8 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 22, minHeight: 28 },
  checkboxHitArea: { paddingVertical: 4, paddingRight: 16, justifyContent: 'flex-start' },
  checkboxLabelWrap: { flex: 1, paddingTop: 2, paddingLeft: 2, justifyContent: 'center' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#000', borderColor: '#000' },
  checkmark: { fontSize: 14, color: '#FFF', fontWeight: '700' },
  checkLabelStandalone: { fontSize: 15, color: '#374151', lineHeight: 22 },
  termsText: { fontSize: 15, color: '#374151', lineHeight: 22 },
  linkInline: { color: '#2563EB', fontWeight: '600', fontSize: 15, lineHeight: 22, textDecorationLine: 'underline' },
  footerInScroll: { marginTop: 28, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  submitBtn: { backgroundColor: '#000', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  credentialsHint: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 10 },
  nextStepHint: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 12, lineHeight: 18 },
  backToLogin: { alignItems: 'center', marginTop: 20, paddingBottom: 8 },
  backToLoginText: { fontSize: 14, color: '#2563EB', fontWeight: '500' },
});
