import { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
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
import { supabase } from '../lib/supabase';
import { useAppAlert } from '../contexts/AppAlertContext';
import { getUserErrorMessage } from '../utils/errorMessage';

type Props = NativeStackScreenProps<RootStackParamList, 'CompleteDriverRegistration'>;

const BUCKET = 'driver-documents';

/** Faz upload e retorna o path no bucket (armazenado no banco; leitura via signed URL se necessário). */
async function uploadImage(userId: string, uri: string, path: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return data.path;
}

export function CompleteDriverRegistrationScreen({ navigation, route }: Props) {
  const { driverType } = route.params;
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [age, setAge] = useState('');
  const [city, setCity] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');

  const [bankCode, setBankCode] = useState('');
  const [agencyNumber, setAgencyNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [pixKey, setPixKey] = useState('');

  const [cnhFrontUri, setCnhFrontUri] = useState<string | null>(null);
  const [cnhBackUri, setCnhBackUri] = useState<string | null>(null);
  const [criminalRecordUri, setCriminalRecordUri] = useState<string | null>(null);

  const [vehicleType, setVehicleType] = useState<'carro' | 'moto'>('carro');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleChassis, setVehicleChassis] = useState('');
  const [vehicleDocUri, setVehicleDocUri] = useState<string | null>(null);
  const [vehiclePhotosUris, setVehiclePhotosUris] = useState<string[]>([]);

  const [deliveryValue, setDeliveryValue] = useState('');
  const [kmValue, setKmValue] = useState('');

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedNotifications, setAcceptedNotifications] = useState(false);

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
    });
    if (!result.canceled && result.assets[0]) callback(result.assets[0].uri);
  };

  const pickMultipleImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permissão', 'É necessário permitir acesso às fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length)
      setVehiclePhotosUris((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      showAlert('Atenção', 'Preencha o nome completo.');
      return;
    }
    if (!cpf.trim()) {
      showAlert('Atenção', 'Preencha o CPF.');
      return;
    }
    if (!acceptedTerms) {
      showAlert('Atenção', 'Aceite os Termos de Uso e a Política de Privacidade.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showAlert('Erro', 'Sessão expirada. Faça login novamente.');
      return;
    }

    setLoading(true);
    try {
      const userId = user.id;

      const uploads: Promise<string>[] = [];
      const paths: { key: string; idx?: number }[] = [];

      if (cnhFrontUri) {
        paths.push({ key: 'cnh_front' });
        uploads.push(uploadImage(userId, cnhFrontUri, `${userId}/cnh_front.jpg`));
      }
      if (cnhBackUri) {
        paths.push({ key: 'cnh_back' });
        uploads.push(uploadImage(userId, cnhBackUri, `${userId}/cnh_back.jpg`));
      }
      if (criminalRecordUri) {
        paths.push({ key: 'criminal_record' });
        uploads.push(uploadImage(userId, criminalRecordUri, `${userId}/criminal_record.jpg`));
      }
      if (vehicleDocUri) {
        paths.push({ key: 'vehicle_doc' });
        uploads.push(uploadImage(userId, vehicleDocUri, `${userId}/vehicle_doc.jpg`));
      }
      vehiclePhotosUris.forEach((uri, i) => {
        paths.push({ key: 'vehicle_photo', idx: i });
        uploads.push(uploadImage(userId, uri, `${userId}/vehicle_${i}.jpg`));
      });

      const uploadedPaths = await Promise.all(uploads);
      let i = 0;
      const getPath = () => (i < uploadedPaths.length ? uploadedPaths[i++] : null);
      const cnhFrontUrl = cnhFrontUri ? getPath() : null;
      const cnhBackUrl = cnhBackUri ? getPath() : null;
      const criminalRecordUrl = criminalRecordUri ? getPath() : null;
      const vehicleDocumentUrl = vehicleDocUri ? getPath() : null;
      const vehiclePhotosUrls = vehiclePhotosUris.map(() => getPath()).filter(Boolean) as string[];

      const { error } = await supabase.from('motorista_profiles').upsert(
        {
          profile_id: user.id,
          driver_type: driverType,
          full_name: fullName.trim(),
          cpf: cpf.replace(/\D/g, ''),
          age: age.trim() ? parseInt(age, 10) : null,
          city: city.trim() || null,
          years_of_experience: yearsOfExperience.trim() ? parseInt(yearsOfExperience, 10) : null,
          bank_code: bankCode.trim() || null,
          agency_number: agencyNumber.trim() || null,
          account_number: accountNumber.trim() || null,
          pix_key: pixKey.trim() || null,
          cnh_front_url: cnhFrontUrl,
          cnh_back_url: cnhBackUrl,
          criminal_record_url: criminalRecordUrl,
          vehicle_type: vehicleType,
          vehicle_year: vehicleYear.trim() ? parseInt(vehicleYear, 10) : null,
          vehicle_model: vehicleModel.trim() || null,
          vehicle_chassis: vehicleChassis.trim() || null,
          vehicle_document_url: vehicleDocumentUrl,
          vehicle_photos_urls: vehiclePhotosUrls,
          delivery_value: deliveryValue.trim() ? parseFloat(deliveryValue.replace(/\D,/g, '').replace(',', '.')) : null,
          km_value: kmValue.trim() ? parseFloat(kmValue.replace(/\D,/g, '').replace(',', '.')) : null,
          accepted_terms: acceptedTerms,
          accepted_notifications: acceptedNotifications,
          status: 'pending',
        },
        { onConflict: 'profile_id' }
      );

      if (error) throw error;
      navigation.replace('RegistrationSuccess');
    } catch (err: unknown) {
      showAlert('Erro', getUserErrorMessage(err, 'Não foi possível enviar o cadastro. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  const sectionTitle = (title: string) => <Text style={styles.sectionTitle}>{title}</Text>;
  const input = (placeholder: string, value: string, onChange: (s: string) => void, key?: string) => (
    <TextInput
      key={key}
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      value={value}
      onChangeText={onChange}
    />
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete seu cadastro</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Complete seu cadastro</Text>
        <Text style={styles.pageSubtitle}>
          Preencha as informações para agilizar a sua entrada no aplicativo e começar a receber encomendas.
        </Text>

        {sectionTitle('Dados básicos')}
        {input('Digite seu nome completo', fullName, setFullName)}
        {input('ex: 123.456.789-99', cpf, setCpf)}
        {input('ex: 23 anos', age, setAge)}
        {input('ex: Belo Horizonte', city, setCity)}
        {input('ex: 6 anos', yearsOfExperience, setYearsOfExperience)}

        {sectionTitle('Dados bancários')}
        {input('ex: 0001', bankCode, setBankCode)}
        {input('ex: 0240', agencyNumber, setAgencyNumber)}
        {input('ex: 12345678-0', accountNumber, setAccountNumber)}
        {input('Ex: meuemail@gmail.com', pixKey, setPixKey)}

        {sectionTitle('Documentos')}
        <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setCnhFrontUri)}>
          <MaterialIcons name="cloud-upload" size={40} color="#9CA3AF" />
          <Text style={styles.uploadTitle}>CNH (frente e verso)</Text>
          <Text style={styles.uploadSub}>Upload frente e verso. Arquivos até 20MB.</Text>
          {cnhFrontUri && <Text style={styles.uploadOk}>✓ Frente adicionada</Text>}
          {cnhBackUri && <Text style={styles.uploadOk}>✓ Verso adicionada</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setCnhBackUri)}>
          <Text style={styles.uploadSub}>Toque para adicionar o verso da CNH</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setCriminalRecordUri)}>
          <MaterialIcons name="cloud-upload" size={40} color="#9CA3AF" />
          <Text style={styles.uploadTitle}>Antecedentes Criminais</Text>
          <Text style={styles.uploadSub}>Emita no site da Polícia Federal. Válido nos últimos 90 dias.</Text>
          {criminalRecordUri && <Text style={styles.uploadOk}>✓ Documento adicionado</Text>}
        </TouchableOpacity>

        {sectionTitle('Veículo de transporte')}
        <View style={styles.radioRow}>
          <TouchableOpacity style={[styles.radioOption, vehicleType === 'carro' && styles.radioOptionSelected]} onPress={() => setVehicleType('carro')}>
            <View style={[styles.radio, vehicleType === 'carro' && styles.radioSelected]}>{vehicleType === 'carro' && <View style={styles.radioInner} />}</View>
            <Text style={styles.radioLabel}>Carro</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.radioOption, vehicleType === 'moto' && styles.radioOptionSelected]} onPress={() => setVehicleType('moto')}>
            <View style={[styles.radio, vehicleType === 'moto' && styles.radioSelected]}>{vehicleType === 'moto' && <View style={styles.radioInner} />}</View>
            <Text style={styles.radioLabel}>Moto</Text>
          </TouchableOpacity>
        </View>
        {input('Ex: 2016', vehicleYear, setVehicleYear)}
        {input('Ex: Honda CB 500x', vehicleModel, setVehicleModel)}
        {input('Ex: 9B0AH1710W017771', vehicleChassis, setVehicleChassis)}
        <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setVehicleDocUri)}>
          <MaterialIcons name="cloud-upload" size={40} color="#9CA3AF" />
          <Text style={styles.uploadSub}>Documento do veículo - Clique para fazer upload</Text>
          {vehicleDocUri && <Text style={styles.uploadOk}>✓ Adicionado</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadBox} onPress={pickMultipleImages}>
          <MaterialIcons name="cloud-upload" size={40} color="#9CA3AF" />
          <Text style={styles.uploadSub}>Fotos do veículo (frente, traseira, lateral, interior). Múltiplas fotos.</Text>
          {vehiclePhotosUris.length > 0 && <Text style={styles.uploadOk}>✓ {vehiclePhotosUris.length} foto(s)</Text>}
        </TouchableOpacity>

        {sectionTitle('Valores e precificação')}
        <Text style={styles.subLabel}>Valores de serviço</Text>
        {input('Ex: R$ 15,00', deliveryValue, setDeliveryValue)}
        <Text style={styles.subLabel}>Valor por km (R$) - Calculado a cada 100m</Text>
        {input('Ex: R$ 2,50', kmValue, setKmValue)}

        <TouchableOpacity style={styles.checkRow} onPress={() => setAcceptedTerms((v) => !v)}>
          <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>{acceptedTerms && <Text style={styles.checkmark}>✓</Text>}</View>
          <Text style={styles.checkLabel}>Li e aceito os Termos de Uso e Política de Privacidade.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.checkRow} onPress={() => setAcceptedNotifications((v) => !v)}>
          <View style={[styles.checkbox, acceptedNotifications && styles.checkboxChecked]}>{acceptedNotifications && <Text style={styles.checkmark}>✓</Text>}</View>
          <Text style={styles.checkLabel}>Aceito receber e-mails e notificações do Take Me.</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.8}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Enviar cadastro</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backToLogin}>
          <Text style={styles.backToLoginText}>Voltar para o login</Text>
        </TouchableOpacity>
      </View>
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
  subLabel: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000',
    marginBottom: 16,
  },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadTitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginTop: 8 },
  uploadSub: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  uploadOk: { fontSize: 13, color: '#059669', marginTop: 6, fontWeight: '600' },
  radioRow: { flexDirection: 'row', gap: 24, marginBottom: 16 },
  radioOption: { flexDirection: 'row', alignItems: 'center' },
  radioOptionSelected: {},
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  radioSelected: { borderColor: '#000' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#000' },
  radioLabel: { fontSize: 16, color: '#111827' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkboxChecked: { backgroundColor: '#000', borderColor: '#000' },
  checkmark: { fontSize: 14, color: '#FFF', fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  footer: { paddingHorizontal: 24, paddingTop: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  submitBtn: { backgroundColor: '#000', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.8 },
  submitBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  backToLogin: { alignItems: 'center', marginTop: 16 },
  backToLoginText: { fontSize: 14, color: '#2563EB', fontWeight: '500' },
});
