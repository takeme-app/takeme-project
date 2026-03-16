import { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Text } from '../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAppAlert } from '../contexts/AppAlertContext';
import { getUserErrorMessage } from '../utils/errorMessage';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function SignUpScreen({ navigation, route }: Props) {
  const driverType = route.params?.driverType;
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hidePassword, setHidePassword] = useState(true);
  const [hideConfirm, setHideConfirm] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const openTerms = () => navigation.navigate('TermsOfUse');
  const openPrivacy = () => navigation.navigate('PrivacyPolicy');

  const handlePhoneChange = (text: string) => setPhone(formatPhone(text));

  const handleContinue = async () => {
    const phoneDigits = phone.replace(/\D/g, '');
    if (!fullName.trim()) {
      showAlert('Atenção', 'Preencha seu nome.');
      return;
    }
    if (!email.trim()) {
      showAlert('Atenção', 'Preencha o e-mail.');
      return;
    }
    if (password.length < 8) {
      showAlert('Atenção', 'A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      showAlert('Atenção', 'As senhas não coincidem.');
      return;
    }
    if (!agreeTerms) {
      showAlert('Atenção', 'Aceite os Termos de Uso e a Política de Privacidade.');
      return;
    }
    if (phoneDigits.length < 10) {
      showAlert('Atenção', 'Preencha o telefone com DDD e número.');
      return;
    }
    if (!isSupabaseConfigured) {
      showAlert('Erro', 'Supabase não configurado. Verifique o .env.');
      return;
    }

    setLoading(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        'send-email-verification-code',
        { body: { email: email.trim(), phone: phoneDigits } }
      );
      const apiErrorMsg =
        fnData && typeof fnData === 'object' && fnData !== null && 'error' in fnData
          ? String((fnData as { error: unknown }).error)
          : null;
      if (apiErrorMsg) {
        showAlert('Atenção', apiErrorMsg);
        setLoading(false);
        return;
      }
      if (fnError) {
        const err = fnError as unknown as { context?: { json?: () => Promise<unknown>; body?: unknown } };
        let bodyError: string | null = null;
        if (err?.context && typeof (err.context as { json?: () => Promise<unknown> }).json === 'function') {
          try {
            const body = await (err.context as { json: () => Promise<Record<string, unknown>> }).json();
            if (body && typeof body === 'object' && body !== null && 'error' in body)
              bodyError = String((body as { error: unknown }).error);
          } catch (_) {}
        }
        if (!bodyError && err?.context?.body && typeof err.context.body === 'object' && err.context.body !== null && 'error' in (err.context.body as object))
          bodyError = String((err.context.body as { error: unknown }).error);
        if (bodyError) {
          showAlert('Atenção', bodyError);
          setLoading(false);
          return;
        }
        throw fnError;
      }

      navigation.navigate('VerifyEmail', {
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phoneDigits,
        ...(driverType && { driverType }),
      });
    } catch (err: unknown) {
      showAlert('Atenção', getUserErrorMessage(err, 'Não foi possível enviar o código. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: Math.max(12, insets.top) }]}>
        <TouchableOpacity style={styles.backButtonCircle} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(48, insets.bottom + 24) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Preencha seus dados para começar</Text>

        <TextInput style={styles.input} placeholder="Nome e sobrenome" placeholderTextColor="#9CA3AF" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
        <TextInput style={styles.input} placeholder="(00) 00000-0000" placeholderTextColor="#9CA3AF" value={phone} onChangeText={handlePhoneChange} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#9CA3AF" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <View style={styles.passwordRow}>
          <TextInput style={[styles.input, styles.inputPassword]} placeholder="Senha (mín. 8 caracteres)" placeholderTextColor="#9CA3AF" value={password} onChangeText={setPassword} secureTextEntry={hidePassword} />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setHidePassword((v) => !v)}>
            <MaterialIcons name={hidePassword ? 'visibility' : 'visibility-off'} size={22} color="#6B7280" style={styles.eyeIconCenter} />
          </TouchableOpacity>
        </View>
        <View style={styles.passwordRow}>
          <TextInput style={[styles.input, styles.inputPassword]} placeholder="Confirme a senha" placeholderTextColor="#9CA3AF" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={hideConfirm} />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setHideConfirm((v) => !v)}>
            <MaterialIcons name={hideConfirm ? 'visibility' : 'visibility-off'} size={22} color="#6B7280" style={styles.eyeIconCenter} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.continueButton, loading && styles.continueButtonDisabled]} activeOpacity={0.8} onPress={handleContinue} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.continueButtonText}>Continuar</Text>}
        </TouchableOpacity>

        <View style={styles.checkboxRow}>
          <TouchableOpacity onPress={() => setAgreeTerms((v) => !v)} activeOpacity={0.7} style={styles.checkboxTouch}>
            <View style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}>{agreeTerms && <Text style={styles.checkmark}>✓</Text>}</View>
          </TouchableOpacity>
          <View style={styles.checkboxLabelWrap}>
            <Text style={styles.checkboxLabelInline}>Concordo com os </Text>
            <TouchableOpacity onPress={openTerms} activeOpacity={0.7} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Text style={styles.link}>Termos de Uso</Text>
            </TouchableOpacity>
            <Text style={styles.checkboxLabelInline}> e a </Text>
            <TouchableOpacity onPress={openPrivacy} activeOpacity={0.7} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <Text style={styles.link}>Política de Privacidade.</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 24, paddingBottom: 16 },
  backButtonCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: '#000000', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#000000', marginTop: 32, marginBottom: 32, lineHeight: 28, textAlign: 'center' },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
    marginBottom: 16,
  },
  passwordRow: { position: 'relative', marginBottom: 0 },
  inputPassword: { paddingRight: 48 },
  eyeButton: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  eyeIconCenter: { marginTop: -3 },
  continueButton: { backgroundColor: '#000000', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8, marginBottom: 24 },
  continueButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  continueButtonDisabled: { opacity: 0.8 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  checkboxTouch: { marginRight: 12, marginTop: 2 },
  checkboxLabelWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#000000', borderColor: '#000000' },
  checkmark: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
  checkboxLabelInline: { fontSize: 14, color: '#374151', lineHeight: 20 },
  link: { color: '#2563EB', fontWeight: '600' },
});
