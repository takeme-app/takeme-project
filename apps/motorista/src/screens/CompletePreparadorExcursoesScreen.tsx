import { useState, type ReactNode } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from '../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppAlert } from '../contexts/AppAlertContext';
import { useDeferredDriverSignup } from '../contexts/DeferredDriverSignupContext';
import { supabase } from '../lib/supabase';
import { resolveWorkerBaseId } from '../lib/resolveWorkerBaseId';
import { GoogleCityAutocomplete } from '../components/GoogleCityAutocomplete';
import type { GoogleGeocodeResult } from '@take-me/shared';
import { formatCpf, onlyDigits, validateCpf } from '../utils/formatCpf';

type Props = NativeStackScreenProps<RootStackParamList, 'CompletePreparadorExcursoes'>;

const BUCKET = 'driver-documents';

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function CompletePreparadorExcursoesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();
  const { email, password, isReady } = useDeferredDriverSignup();

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

  const [bankCode, setBankCode] = useState('');
  const [agencyNumber, setAgencyNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [pixKey, setPixKey] = useState('');

  const [identityDocUri, setIdentityDocUri] = useState<string | null>(null);
  const [willPresentCriminalRecord, setWillPresentCriminalRecord] = useState(false);
  const [criminalRecordUri, setCriminalRecordUri] = useState<string | null>(null);

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedNotifications, setAcceptedNotifications] = useState(false);
  const [loading, setLoading] = useState(false);

  const pickImage = async (callback: (uri: string) => void) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permissão', 'É necessário permitir acesso às fotos para enviar documentos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      callback(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
    }
  };

  const sectionTitle = (title: string) => <Text style={styles.sectionTitle}>{title}</Text>;

  const validateAndSubmit = async () => {
    if (!isReady || !email || !password) {
      showAlert('Atenção', 'Volte e informe e-mail e senha antes de enviar.');
      return;
    }
    if (!fullName.trim()) { showAlert('Atenção', 'Preencha o nome completo.'); return; }
    const cpfDigits = onlyDigits(cpf);
    if (cpfDigits.length !== 11 || !validateCpf(cpf)) { showAlert('CPF inválido', 'Informe um CPF válido.'); return; }
    const ageNum = parseInt(onlyDigits(age), 10);
    if (!ageNum || ageNum < 18 || ageNum > 100) { showAlert('Atenção', 'Informe uma idade válida (18–100).'); return; }
    if (!city.trim()) { showAlert('Atenção', 'Preencha a cidade.'); return; }
    if (!cityResolved) {
      showAlert('Atenção', 'Selecione uma cidade na lista de sugestões (ou digite ao menos 2 caracteres se não houver chave do Google).');
      return;
    }
    const expNum = parseInt(onlyDigits(experienceYears), 10);
    if (!expNum || expNum < 1 || expNum > 60) { showAlert('Atenção', 'Informe os anos de experiência (1–60).'); return; }
    if (!bankCode.trim() || !agencyNumber.trim() || !accountNumber.trim() || !pixKey.trim()) {
      showAlert('Atenção', 'Preencha todos os dados bancários.'); return;
    }
    if (!identityDocUri) { showAlert('Atenção', 'Envie o documento de identidade.'); return; }
    if (willPresentCriminalRecord && !criminalRecordUri) {
      showAlert('Atenção', 'Envie o documento de antecedentes ou desmarque a opção.'); return;
    }
    if (!acceptedTerms) { showAlert('Atenção', 'Aceite os Termos de Uso e a Política de Privacidade.'); return; }

    setLoading(true);
    try {
      const emailNorm = email.trim().toLowerCase();
      const nowIso = new Date().toISOString();

      // Criar conta
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: emailNorm,
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (signUpErr) throw new Error(signUpErr.message);

      let userId = signUpData.user?.id;
      let session = signUpData.session;

      if (!userId) throw new Error('Cadastro não retornou usuário. Tente novamente.');

      if (!session) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email: emailNorm, password });
        if (signInErr) throw new Error(signInErr.message);
        session = signInData.session;
        userId = signInData.user?.id ?? userId;
      }
      if (!session?.user?.id) throw new Error('Sessão não disponível. Confirme o e-mail ou tente novamente.');
      userId = session.user.id;

      // Upload documentos
      const uploadDoc = async (uri: string, path: string): Promise<string> => {
        const base64 = uri.startsWith('data:') ? uri.split(',')[1] ?? '' : null;
        if (!base64) throw new Error('Documento inválido. Selecione a imagem novamente.');
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const { data, error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
          contentType: 'image/jpeg',
          upsert: true,
        });
        if (error) throw new Error(error.message || 'Falha ao enviar documento.');
        return data.path;
      };

      const identityPath = await uploadDoc(identityDocUri, `${userId}/identity_doc.jpg`);
      let criminalPath: string | null = null;
      if (willPresentCriminalRecord && criminalRecordUri) {
        criminalPath = await uploadDoc(criminalRecordUri, `${userId}/criminal_record.jpg`);
      }

      // Atualizar profiles
      await supabase.from('profiles').update({
        full_name: fullName.trim(),
        cpf: cpfDigits,
        city: city.trim(),
        updated_at: nowIso,
      }).eq('id', userId);

      const baseId = await resolveWorkerBaseId(cityMeta.locality, cityMeta.adminArea, city.trim());

      const { error: workerErr } = await supabase.from('worker_profiles').insert({
        id: userId,
        role: 'preparer',
        subtype: 'excursions',
        status: 'inactive',
        cpf: cpfDigits,
        age: ageNum,
        city: city.trim(),
        experience_years: expNum,
        bank_code: bankCode.trim(),
        bank_agency: agencyNumber.trim(),
        bank_account: accountNumber.trim(),
        pix_key: pixKey.trim(),
        has_own_vehicle: false,
        cnh_document_url: identityPath,
        background_check_url: criminalPath,
        base_id: baseId,
        created_at: nowIso,
        updated_at: nowIso,
      });
      if (workerErr) throw new Error(workerErr.message || 'Falha ao salvar perfil.');

      navigation.reset({ index: 0, routes: [{ name: 'RegistrationSuccess' }] });
    } catch (err: unknown) {
      showAlert('Erro', err instanceof Error ? err.message : 'Erro ao enviar cadastro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('SignUpType')} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete seu cadastro</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Complete seu cadastro</Text>
        <Text style={styles.pageSubtitle}>
          Preencha suas informações para que possamos validar seu perfil como preparador de excursões.
        </Text>

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
        <FieldBlock label="Anos de experiência organizando excursões">
          <TextInput style={styles.input} placeholder="Ex: 5" placeholderTextColor="#9CA3AF" value={experienceYears} onChangeText={(t) => setExperienceYears(onlyDigits(t).slice(0, 2))} keyboardType="number-pad" maxLength={2} />
        </FieldBlock>

        {sectionTitle('Dados bancários')}
        <FieldBlock label="Banco">
          <TextInput style={styles.input} placeholder="Ex: 0001 ou nome do banco" placeholderTextColor="#9CA3AF" value={bankCode} onChangeText={setBankCode} />
        </FieldBlock>
        <FieldBlock label="Agência">
          <TextInput style={styles.input} placeholder="Ex: 0240" placeholderTextColor="#9CA3AF" value={agencyNumber} onChangeText={setAgencyNumber} />
        </FieldBlock>
        <FieldBlock label="Conta">
          <TextInput style={styles.input} placeholder="Ex: 12345678-9" placeholderTextColor="#9CA3AF" value={accountNumber} onChangeText={setAccountNumber} />
        </FieldBlock>
        <FieldBlock label="Chave Pix">
          <TextInput style={styles.input} placeholder="Ex: nome@gmail.com" placeholderTextColor="#9CA3AF" value={pixKey} onChangeText={setPixKey} autoCapitalize="none" />
        </FieldBlock>

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
            <Text style={styles.uploadSub}>
              Emitir documento no site da Polícia Federal. O arquivo deve ter sido emitido nos últimos 90 dias.
            </Text>
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
          <TouchableOpacity
            style={[styles.submitBtn, (!isReady || loading) && styles.submitBtnDisabled]}
            onPress={validateAndSubmit}
            activeOpacity={0.8}
            disabled={!isReady || loading}
          >
            <Text style={styles.submitBtnText}>{loading ? 'Enviando...' : 'Enviar cadastro'}</Text>
          </TouchableOpacity>
          {!isReady ? <Text style={styles.credentialsHint}>Conclua a etapa anterior para habilitar o envio.</Text> : null}
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
  input: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#000' },
  uploadBox: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#D1D5DB', borderRadius: 12, padding: 24, alignItems: 'center', marginBottom: 16 },
  uploadTitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginTop: 8 },
  uploadSub: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  uploadOk: { fontSize: 13, color: '#059669', marginTop: 6, fontWeight: '600' },
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
  backToLogin: { alignItems: 'center', marginTop: 20, paddingBottom: 8 },
  backToLoginText: { fontSize: 14, color: '#2563EB', fontWeight: '500' },
});
