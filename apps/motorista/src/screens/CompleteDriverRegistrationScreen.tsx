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
import type { RootStackParamList, RegistrationType } from '../navigation/types';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppAlert } from '../contexts/AppAlertContext';
import { useRegistrationForm, newRoute, type RouteFormEntry } from '../contexts/RegistrationFormContext';
import { useDeferredDriverSignup } from '../contexts/DeferredDriverSignupContext';
import { formatCpf, onlyDigits, validateCpf } from '../utils/formatCpf';
import { formatPhoneBR } from '../utils/formatPhone';
import { formatCurrencyBRLInput } from '../utils/formatCurrency';

type Props = NativeStackScreenProps<RootStackParamList, 'CompleteDriverRegistration'>;

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function CompleteDriverRegistrationScreen({ navigation, route }: Props) {
  const { driverType } = route.params;
  const { email, password, driverType: deferredDriverType, isReady } = useDeferredDriverSignup();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();
  const { setFormData } = useRegistrationForm();

  const credentialsReady =
    isReady && deferredDriverType === driverType && Boolean(email && password);

  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [age, setAge] = useState('');
  const [city, setCity] = useState('');
  const [preferenceArea, setPreferenceArea] = useState('');
  const [experienceYears, setExperienceYears] = useState('');

  const [bankCode, setBankCode] = useState('');
  const [agencyNumber, setAgencyNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [pixKey, setPixKey] = useState('');

  const isParceiro = driverType !== 'take_me';
  const isExcursoes = driverType === 'preparador_excursões';

  const subtitleLabel: Record<RegistrationType, string> = {
    take_me: 'como motorista TakeMe.',
    parceiro: 'como motorista parceiro.',
    preparador_excursões: 'como preparador de excursões.',
    preparador_encomendas: 'como preparador de encomendas.',
  };
  const [ownsVehicle, setOwnsVehicle] = useState(true);
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [vehiclePhone, setVehiclePhone] = useState('');
  const [passengerCapacity, setPassengerCapacity] = useState('');

  const [cnhFrontUri, setCnhFrontUri] = useState<string | null>(null);
  const [cnhBackUri, setCnhBackUri] = useState<string | null>(null);
  const [willPresentCriminalRecord, setWillPresentCriminalRecord] = useState(false);
  const [criminalRecordUri, setCriminalRecordUri] = useState<string | null>(null);
  const [vehicleDocUri, setVehicleDocUri] = useState<string | null>(null);
  const [vehiclePhotosUris, setVehiclePhotosUris] = useState<string[]>([]);

  const [routes, setRoutes] = useState<RouteFormEntry[]>(() => [newRoute()]);

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
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      callback(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
    }
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
      base64: true,
    });
    if (!result.canceled && result.assets.length)
      setVehiclePhotosUris((prev) => [...prev, ...result.assets.map((a) => a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri)]);
  };

  const updateRoute = (id: string, patch: Partial<RouteFormEntry>) => {
    setRoutes((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRouteRow = () => setRoutes((prev) => [...prev, newRoute()]);

  const removeRouteRow = (id: string) => {
    setRoutes((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const validateAndSubmit = () => {
    if (!credentialsReady || !email || !password) {
      showAlert('Atenção', 'Volte e informe e-mail e senha no cadastro inicial antes de enviar.');
      return;
    }
    if (!fullName.trim()) {
      showAlert('Atenção', 'Preencha o nome completo.');
      return;
    }
    const cpfDigits = onlyDigits(cpf);
    if (cpfDigits.length !== 11 || !validateCpf(cpf)) {
      showAlert('CPF inválido', 'Informe um CPF válido com 11 dígitos.');
      return;
    }
    const ageNum = parseInt(onlyDigits(age), 10);
    if (!ageNum || ageNum < 18 || ageNum > 100) {
      showAlert('Atenção', 'Informe uma idade válida (entre 18 e 100 anos).');
      return;
    }
    if (!city.trim()) {
      showAlert('Atenção', 'Preencha a cidade.');
      return;
    }
    if (isParceiro) {
      const expNum = parseInt(onlyDigits(experienceYears), 10);
      if (!expNum || expNum < 1 || expNum > 60) {
        showAlert('Atenção', 'Informe os anos de experiência (entre 1 e 60).');
        return;
      }
    } else {
      if (!preferenceArea.trim()) {
        showAlert('Atenção', 'Preencha a área de preferência.');
        return;
      }
    }
    if (!bankCode.trim() || !agencyNumber.trim() || !accountNumber.trim() || !pixKey.trim()) {
      showAlert('Atenção', 'Preencha todos os dados bancários.');
      return;
    }

    const requiresVehicle = !isExcursoes && (isParceiro || ownsVehicle);
    if (requiresVehicle) {
      if (!vehicleYear.trim() || onlyDigits(vehicleYear).length !== 4) {
        showAlert('Atenção', 'Informe o ano do veículo com 4 dígitos.');
        return;
      }
      const y = parseInt(onlyDigits(vehicleYear), 10);
      const current = new Date().getFullYear();
      if (y < 1980 || y > current + 1) {
        showAlert('Atenção', 'Ano do veículo inválido.');
        return;
      }
      if (!vehicleModel.trim()) {
        showAlert('Atenção', 'Preencha o modelo do veículo.');
        return;
      }
      if (!licensePlate.trim()) {
        showAlert('Atenção', 'Preencha a placa do veículo.');
        return;
      }
      const phoneDigits = onlyDigits(vehiclePhone);
      if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        showAlert('Atenção', 'Informe um telefone válido com DDD.');
        return;
      }
      const maxCap = isParceiro ? 50 : 5;
      const cap = parseInt(onlyDigits(passengerCapacity), 10);
      if (!cap || cap < 1 || cap > maxCap) {
        showAlert('Atenção', `Capacidade de passageiros deve ser entre 1 e ${maxCap}.`);
        return;
      }
      if (!vehicleDocUri) {
        showAlert('Atenção', 'Envie o documento do veículo.');
        return;
      }
      if (vehiclePhotosUris.length < 4) {
        showAlert('Atenção', 'Envie ao menos 4 fotos do veículo.');
        return;
      }
    }

    if (!cnhFrontUri || !cnhBackUri) {
      showAlert('Atenção', 'Envie a CNH (frente e verso).');
      return;
    }
    if (willPresentCriminalRecord && !criminalRecordUri) {
      showAlert('Atenção', 'Envie o documento de antecedentes ou desmarque a opção.');
      return;
    }

    for (let i = 0; i < routes.length; i++) {
      const r = routes[i];
      if (!r.origin.trim() || !r.destination.trim()) {
        showAlert('Atenção', `Preencha origem e destino da rota ${i + 1}.`);
        return;
      }
      const cents = onlyDigits(r.suggestedPrice);
      if (!cents || parseInt(cents, 10) === 0) {
        showAlert('Atenção', `Informe o valor sugerido por passageiro na rota ${i + 1}.`);
        return;
      }
    }

    if (!acceptedTerms) {
      showAlert('Atenção', 'Aceite os Termos de Uso e a Política de Privacidade.');
      return;
    }

    setFormData({
      driverType,
      fullName: fullName.trim(),
      cpf: formatCpf(cpfDigits),
      age: onlyDigits(age),
      city: city.trim(),
      preferenceArea: isParceiro ? '' : preferenceArea.trim(),
      experienceYears: isParceiro ? onlyDigits(experienceYears) : '',
      bankCode: bankCode.trim(),
      agencyNumber: agencyNumber.trim(),
      accountNumber: accountNumber.trim(),
      pixKey: pixKey.trim(),
      ownsVehicle: requiresVehicle,
      vehicleYear: onlyDigits(vehicleYear),
      vehicleModel: vehicleModel.trim(),
      licensePlate: licensePlate.trim().toUpperCase(),
      vehiclePhone: formatPhoneBR(vehiclePhone),
      passengerCapacity: onlyDigits(passengerCapacity),
      routes: routes.map((r) => ({
        ...r,
        origin: r.origin.trim(),
        destination: r.destination.trim(),
        suggestedPrice: r.suggestedPrice,
      })),
      acceptedTerms,
      acceptedNotifications,
      willPresentCriminalRecord,
      cnhFrontUri,
      cnhBackUri,
      criminalRecordUri,
      vehicleDocUri,
      vehiclePhotosUris,
    });
    navigation.navigate('FinalizeRegistration', { driverType });
  };

  const sectionTitle = (title: string) => <Text style={styles.sectionTitle}>{title}</Text>;

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
          Preencha suas informações para que possamos validar seu perfil {subtitleLabel[driverType]}
        </Text>

        {sectionTitle('Dados básicos')}
        <FieldBlock label="Nome completo">
          <TextInput
            style={styles.input}
            placeholder="Digite seu nome completo"
            placeholderTextColor="#9CA3AF"
            value={fullName}
            onChangeText={setFullName}
          />
        </FieldBlock>
        <FieldBlock label="CPF">
          <TextInput
            style={styles.input}
            placeholder="Ex: 123.456.789-00"
            placeholderTextColor="#9CA3AF"
            value={cpf}
            onChangeText={(t) => setCpf(formatCpf(t))}
            keyboardType="number-pad"
            maxLength={14}
          />
        </FieldBlock>
        <FieldBlock label="Idade">
          <TextInput
            style={styles.input}
            placeholder="Ex: 25 anos"
            placeholderTextColor="#9CA3AF"
            value={age}
            onChangeText={(t) => setAge(onlyDigits(t).slice(0, 3))}
            keyboardType="number-pad"
            maxLength={3}
          />
        </FieldBlock>
        <FieldBlock label="Cidade">
          <TextInput
            style={styles.input}
            placeholder="Digite sua cidade"
            placeholderTextColor="#9CA3AF"
            value={city}
            onChangeText={setCity}
          />
        </FieldBlock>
        {isParceiro ? (
          <FieldBlock label="Anos de experiência">
            <TextInput
              style={styles.input}
              placeholder="Ex: 5"
              placeholderTextColor="#9CA3AF"
              value={experienceYears}
              onChangeText={(t) => setExperienceYears(onlyDigits(t).slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
            />
          </FieldBlock>
        ) : (
          <FieldBlock label="Área de preferência">
            <TextInput
              style={styles.input}
              placeholder="Ex: Bairro"
              placeholderTextColor="#9CA3AF"
              value={preferenceArea}
              onChangeText={setPreferenceArea}
            />
          </FieldBlock>
        )}

        {sectionTitle('Dados bancários')}
        <FieldBlock label="Banco">
          <TextInput
            style={styles.input}
            placeholder="Ex: 0001 ou nome do banco"
            placeholderTextColor="#9CA3AF"
            value={bankCode}
            onChangeText={setBankCode}
          />
        </FieldBlock>
        <FieldBlock label="Agência">
          <TextInput
            style={styles.input}
            placeholder="Ex: 0000"
            placeholderTextColor="#9CA3AF"
            value={agencyNumber}
            onChangeText={setAgencyNumber}
          />
        </FieldBlock>
        <FieldBlock label="Conta">
          <TextInput
            style={styles.input}
            placeholder="Ex: 12345678-9"
            placeholderTextColor="#9CA3AF"
            value={accountNumber}
            onChangeText={setAccountNumber}
          />
        </FieldBlock>
        <FieldBlock label="Chave Pix">
          <TextInput
            style={styles.input}
            placeholder="Ex: nome@gmail.com"
            placeholderTextColor="#9CA3AF"
            value={pixKey}
            onChangeText={setPixKey}
            autoCapitalize="none"
          />
        </FieldBlock>

        {!isExcursoes ? sectionTitle('Veículo de transporte') : null}
        {(!isExcursoes && !isParceiro) ? (
          <>
            <Text style={styles.questionLabel}>Possui veículo próprio?</Text>
            <View style={styles.radioRow}>
              <TouchableOpacity
                style={[styles.radioOption, ownsVehicle && styles.radioOptionSelected]}
                onPress={() => setOwnsVehicle(true)}
                activeOpacity={0.7}
              >
                <View style={[styles.radio, ownsVehicle && styles.radioSelected]}>
                  {ownsVehicle ? <View style={styles.radioInner} /> : null}
                </View>
                <Text style={styles.radioLabel}>Sim</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.radioOption, !ownsVehicle && styles.radioOptionSelected]}
                onPress={() => setOwnsVehicle(false)}
                activeOpacity={0.7}
              >
                <View style={[styles.radio, !ownsVehicle && styles.radioSelected]}>
                  {!ownsVehicle ? <View style={styles.radioInner} /> : null}
                </View>
                <Text style={styles.radioLabel}>Não</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
        {(!isExcursoes && (isParceiro || ownsVehicle)) ? (
          <>
            <FieldBlock label="Ano do veículo">
              <TextInput
                style={styles.input}
                placeholder="Ex: 2020"
                placeholderTextColor="#9CA3AF"
                value={vehicleYear}
                onChangeText={(t) => setVehicleYear(onlyDigits(t).slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
              />
            </FieldBlock>
            <FieldBlock label="Modelo">
              <TextInput
                style={styles.input}
                placeholder="Ex: Honda Civic"
                placeholderTextColor="#9CA3AF"
                value={vehicleModel}
                onChangeText={setVehicleModel}
              />
            </FieldBlock>
            <FieldBlock label="Placa">
              <TextInput
                style={styles.input}
                placeholder="Ex: ABC1D23"
                placeholderTextColor="#9CA3AF"
                value={licensePlate}
                onChangeText={(t) => setLicensePlate(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={10}
              />
            </FieldBlock>
            <FieldBlock label="Telefone">
              <TextInput
                style={styles.input}
                placeholder="Ex: (11) 98765-4321"
                placeholderTextColor="#9CA3AF"
                value={vehiclePhone}
                onChangeText={(t) => setVehiclePhone(formatPhoneBR(t))}
                keyboardType="phone-pad"
                maxLength={16}
              />
            </FieldBlock>
            <FieldBlock label={isParceiro ? 'Capacidade de passageiros (máx. 50)' : 'Capacidade de passageiros (máx. 5)'}>
              <TextInput
                style={styles.input}
                placeholder={isParceiro ? 'Ex: 15' : 'Ex: 4'}
                placeholderTextColor="#9CA3AF"
                value={passengerCapacity}
                onChangeText={(t) => setPassengerCapacity(onlyDigits(t).slice(0, isParceiro ? 2 : 1))}
                keyboardType="number-pad"
                maxLength={isParceiro ? 2 : 1}
              />
            </FieldBlock>
            <TouchableOpacity
              style={styles.textLinkWrap}
              onPress={() => showAlert('Em breve', 'Cadastro de mais de um veículo estará disponível em breve.')}
              activeOpacity={0.7}
            >
              <Text style={styles.textLink}>+ Adicionar outro veículo</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {sectionTitle('Documentos')}
        <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setCnhFrontUri)} activeOpacity={0.8}>
          <MaterialIcons name="cloud-upload" size={40} color="#9CA3AF" />
          <Text style={styles.uploadTitle}>CNH frente e verso</Text>
          <Text style={styles.uploadSub}>Envie a frente da CNH. Toque de novo em outra caixa para o verso.</Text>
          {cnhFrontUri ? <Text style={styles.uploadOk}>✓ Frente adicionada</Text> : null}
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setCnhBackUri)} activeOpacity={0.8}>
          <MaterialIcons name="cloud-upload" size={40} color="#9CA3AF" />
          <Text style={styles.uploadSub}>Clique para enviar o verso da CNH</Text>
          {cnhBackUri ? <Text style={styles.uploadOk}>✓ Verso adicionado</Text> : null}
        </TouchableOpacity>

        <View style={styles.checkboxRow}>
          <TouchableOpacity
            onPress={() => setWillPresentCriminalRecord((v) => !v)}
            activeOpacity={0.7}
            style={styles.checkboxHitArea}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: willPresentCriminalRecord }}
          >
            <View style={[styles.checkbox, willPresentCriminalRecord && styles.checkboxChecked]}>
              {willPresentCriminalRecord ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.checkboxLabelWrap}
            onPress={() => setWillPresentCriminalRecord((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.checkLabelStandalone}>Apresentar Antecedentes Criminais</Text>
          </TouchableOpacity>
        </View>
        {willPresentCriminalRecord ? (
          <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setCriminalRecordUri)} activeOpacity={0.8}>
            <MaterialIcons name="cloud-upload" size={40} color="#9CA3AF" />
            <Text style={styles.uploadSub}>Clique para fazer o upload</Text>
            {criminalRecordUri ? <Text style={styles.uploadOk}>✓ Documento adicionado</Text> : null}
          </TouchableOpacity>
        ) : null}

        {(!isExcursoes && (isParceiro || ownsVehicle)) ? (
          <>
            <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setVehicleDocUri)} activeOpacity={0.8}>
              <MaterialIcons name="cloud-upload" size={40} color="#9CA3AF" />
              <Text style={styles.uploadTitle}>Documento do veículo</Text>
              <Text style={styles.uploadSub}>Clique para fazer o upload</Text>
              {vehicleDocUri ? <Text style={styles.uploadOk}>✓ Adicionado</Text> : null}
            </TouchableOpacity>
            <Text style={styles.photosSectionTitle}>Fotos do veículo</Text>
            <Text style={styles.photosSectionHint}>Envie ao menos 4 fotos</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={pickMultipleImages} activeOpacity={0.8}>
              <MaterialIcons name="cloud-upload" size={40} color="#9CA3AF" />
              <Text style={styles.uploadSub}>Clique para fazer upload (múltiplas fotos)</Text>
              {vehiclePhotosUris.length > 0 ? (
                <Text style={styles.uploadOk}>✓ {vehiclePhotosUris.length} foto(s)</Text>
              ) : null}
            </TouchableOpacity>
          </>
        ) : null}

        {sectionTitle('Rotas e valores')}
        {routes.map((r, index) => (
          <View key={r.id} style={styles.routeCard}>
            <View style={styles.routeCardHeader}>
              <Text style={styles.routeCardTitle}>Rota {index + 1}</Text>
              {routes.length > 1 ? (
                <TouchableOpacity onPress={() => removeRouteRow(r.id)} activeOpacity={0.7}>
                  <Text style={styles.routeRemove}>Remover</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <FieldBlock label="Origem">
              <TextInput
                style={styles.input}
                placeholder="Ex: São Paulo"
                placeholderTextColor="#9CA3AF"
                value={r.origin}
                onChangeText={(t) => updateRoute(r.id, { origin: t })}
              />
            </FieldBlock>
            <FieldBlock label="Destino">
              <TextInput
                style={styles.input}
                placeholder="Ex: Interior"
                placeholderTextColor="#9CA3AF"
                value={r.destination}
                onChangeText={(t) => updateRoute(r.id, { destination: t })}
              />
            </FieldBlock>
            <FieldBlock label="Valor sugerido por passageiro">
              <TextInput
                style={styles.input}
                placeholder="Ex: R$ 50,00"
                placeholderTextColor="#9CA3AF"
                value={r.suggestedPrice ? `R$ ${r.suggestedPrice}` : ''}
                onChangeText={(t) => {
                  const cleaned = t.replace(/R\$\s?/i, '');
                  updateRoute(r.id, { suggestedPrice: formatCurrencyBRLInput(cleaned) });
                }}
                keyboardType="number-pad"
              />
            </FieldBlock>
            {index === 0 ? (
              <Text style={styles.helperBelowField}>Este valor será usado como referência por passageiro nesta rota.</Text>
            ) : null}
          </View>
        ))}
        <TouchableOpacity style={styles.textLinkWrap} onPress={addRouteRow} activeOpacity={0.7}>
          <Text style={styles.textLink}>+ Adicionar mais rota</Text>
        </TouchableOpacity>

        <View style={styles.checksSection}>
          <View style={styles.checkboxRow}>
            <TouchableOpacity
              onPress={() => setAcceptedTerms((v) => !v)}
              activeOpacity={0.7}
              style={styles.checkboxHitArea}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedTerms }}
            >
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
            </TouchableOpacity>
            <View style={styles.checkboxLabelWrap}>
              <Text style={styles.termsText}>
                Concordo com os{' '}
                <Text style={styles.linkInline} onPress={() => navigation.navigate('TermsOfUse')}>
                  Termos de Uso
                </Text>
                {' '}e a{' '}
                <Text style={styles.linkInline} onPress={() => navigation.navigate('PrivacyPolicy')}>
                  Política de Privacidade
                </Text>
                .
              </Text>
            </View>
          </View>

          <View style={styles.checkboxRow}>
            <TouchableOpacity
              onPress={() => setAcceptedNotifications((v) => !v)}
              activeOpacity={0.7}
              style={styles.checkboxHitArea}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedNotifications }}
            >
              <View style={[styles.checkbox, acceptedNotifications && styles.checkboxChecked]}>
                {acceptedNotifications ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.checkboxLabelWrap}
              onPress={() => setAcceptedNotifications((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.checkLabelStandalone}>
                Aceito receber notificações e avisos de corridas.
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.footerInScroll, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[styles.submitBtn, !credentialsReady && styles.submitBtnDisabled]}
            onPress={validateAndSubmit}
            activeOpacity={0.8}
          >
            <Text style={styles.submitBtnText}>Enviar cadastro</Text>
          </TouchableOpacity>
          {!credentialsReady ? (
            <Text style={styles.credentialsHint}>Conclua a verificação do e-mail para habilitar o envio.</Text>
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
  helperBelowField: { fontSize: 13, color: '#6B7280', marginTop: -8, marginBottom: 12 },
  input: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000',
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
  photosSectionTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 4 },
  photosSectionHint: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  radioRow: { flexDirection: 'row', gap: 28, marginBottom: 16 },
  radioOption: { flexDirection: 'row', alignItems: 'center' },
  radioOptionSelected: {},
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  radioSelected: { borderColor: '#000' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#000' },
  radioLabel: { fontSize: 16, color: '#111827' },
  checksSection: { marginTop: 8, marginBottom: 8 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 22,
    minHeight: 28,
  },
  checkboxHitArea: {
    paddingVertical: 4,
    paddingRight: 16,
    justifyContent: 'flex-start',
  },
  checkboxLabelWrap: {
    flex: 1,
    paddingTop: 2,
    paddingLeft: 2,
    justifyContent: 'center',
  },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#000', borderColor: '#000' },
  checkmark: { fontSize: 14, color: '#FFF', fontWeight: '700' },
  checkLabelStandalone: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  termsText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  linkInline: {
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 22,
    textDecorationLine: 'underline',
  },
  textLinkWrap: { marginBottom: 16 },
  textLink: { fontSize: 14, color: '#2563EB', fontWeight: '500', textDecorationLine: 'underline' },
  footerInScroll: {
    marginTop: 28,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  routeCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  routeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeCardTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  routeRemove: { fontSize: 14, color: '#DC2626', fontWeight: '600' },
  submitBtn: { backgroundColor: '#000', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  credentialsHint: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 10 },
  backToLogin: { alignItems: 'center', marginTop: 20, paddingBottom: 8 },
  backToLoginText: { fontSize: 14, color: '#2563EB', fontWeight: '500' },
});
