import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { parseInvokeError } from '../utils/edgeFunctionResponse';
import { useDeferredDriverSignup } from '../contexts/DeferredDriverSignupContext';
import { isValidEmailFormat } from '../utils/validateEmail';
import {
  checkEmailAvailability,
  type EmailAvailability,
} from '../lib/checkEmailAvailability';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

/** Debounce da checagem de e-mail após `onBlur`/digitação: evita rajadas de `functions.invoke`. */
const EMAIL_AVAILABILITY_DEBOUNCE_MS = 500;
const PASSWORD_MIN_LEN = 8;

type EmailCheckStatus = 'idle' | 'checking' | EmailAvailability | 'format';

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isDeferredRegistration(t: string | undefined): boolean {
  return t === 'take_me' || t === 'parceiro' || t === 'preparador_excursões' || t === 'preparador_encomendas';
}

export function SignUpScreen({ navigation, route }: Props) {
  const registrationType = route.params?.registrationType;
  const driverFirst = isDeferredRegistration(registrationType);
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();
  const { setDeferred } = useDeferredDriverSignup();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hidePassword, setHidePassword] = useState(true);
  const [hideConfirm, setHideConfirm] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  // Feedback inline do e-mail (formato + checagem de existência no servidor).
  const [emailStatus, setEmailStatus] = useState<EmailCheckStatus>('idle');
  const [emailStatusMsg, setEmailStatusMsg] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const openTerms = () => navigation.navigate('TermsOfUse');
  const openPrivacy = () => navigation.navigate('PrivacyPolicy');

  const handlePhoneChange = (text: string) => setPhone(formatPhone(text));

  const emailNormalized = email.trim();
  const emailFormatValid = useMemo(() => isValidEmailFormat(emailNormalized), [emailNormalized]);

  // Checagem de existência do e-mail no servidor, com debounce + race guard.
  const lastQueryRef = useRef<string>('');
  useEffect(() => {
    if (!emailNormalized) {
      setEmailStatus('idle');
      setEmailStatusMsg(null);
      return;
    }
    if (!emailFormatValid) {
      setEmailStatus('format');
      setEmailStatusMsg('E-mail em formato inválido.');
      return;
    }

    let cancelled = false;
    setEmailStatus('checking');
    setEmailStatusMsg(null);
    const query = emailNormalized.toLowerCase();
    lastQueryRef.current = query;
    const timer = setTimeout(async () => {
      const result = await checkEmailAvailability(query);
      if (cancelled || lastQueryRef.current !== query) return;
      setEmailStatus(result.status);
      setEmailStatusMsg(result.message ?? null);
    }, EMAIL_AVAILABILITY_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [emailNormalized, emailFormatValid]);

  const handleEmailBlur = useCallback(() => setEmailTouched(true), []);
  const handlePasswordBlur = useCallback(() => setPasswordTouched(true), []);
  const handleConfirmBlur = useCallback(() => setConfirmTouched(true), []);

  const passwordValid = password.length >= PASSWORD_MIN_LEN;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const formReadyToSubmit =
    emailFormatValid &&
    (emailStatus === 'available' || emailStatus === 'error') &&
    passwordValid &&
    passwordsMatch &&
    !loading;

  const handleContinue = async () => {
    setEmailTouched(true);
    setPasswordTouched(true);
    setConfirmTouched(true);

    if (!emailFormatValid) {
      showAlert('Atenção', 'Informe um e-mail válido.');
      return;
    }
    if (emailStatus === 'taken') {
      showAlert('Atenção', emailStatusMsg ?? 'Este e-mail já está cadastrado.');
      return;
    }
    if (emailStatus === 'checking') {
      showAlert('Aguarde', 'Ainda estamos verificando o e-mail.');
      return;
    }
    if (!passwordValid) {
      showAlert('Atenção', `A senha deve ter no mínimo ${PASSWORD_MIN_LEN} caracteres.`);
      return;
    }
    if (!passwordsMatch) {
      showAlert('Atenção', 'As senhas não coincidem.');
      return;
    }
    if (!isSupabaseConfigured) {
      showAlert('Erro', 'Supabase não configurado. Verifique o .env.');
      return;
    }

    if (driverFirst) {
      if (!registrationType) return;
      setLoading(true);
      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke('send-email-verification-code', {
          body: { email: emailNormalized, purpose: 'signup', checkEmailOnly: true },
        });
        const apiErrorMsg =
          fnData && typeof fnData === 'object' && fnData !== null && 'error' in fnData
            ? String((fnData as { error: unknown }).error)
            : null;
        if (apiErrorMsg) {
          setEmailStatus('taken');
          setEmailStatusMsg(apiErrorMsg);
          showAlert('Atenção', apiErrorMsg);
          return;
        }
        if (fnError) {
          const bodyError = await parseInvokeError(fnError);
          if (bodyError) {
            setEmailStatus('taken');
            setEmailStatusMsg(bodyError);
            showAlert('Atenção', bodyError);
            return;
          }
          throw fnError;
        }
        setDeferred({ email: emailNormalized, password, driverType: registrationType });
        if (registrationType === 'preparador_excursões') {
          navigation.navigate('CompletePreparadorExcursoes');
        } else if (registrationType === 'preparador_encomendas') {
          navigation.navigate('CompletePreparadorEncomendas');
        } else {
          navigation.navigate('CompleteDriverRegistration', { driverType: registrationType });
        }
      } catch (err: unknown) {
        showAlert('Atenção', getUserErrorMessage(err, 'Não foi possível validar o e-mail. Tente novamente.'));
      } finally {
        setLoading(false);
      }
      return;
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (!fullName.trim()) {
      showAlert('Atenção', 'Preencha seu nome.');
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

    setLoading(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('send-email-verification-code', {
        body: { email: emailNormalized, phone: phoneDigits },
      });
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
        const bodyError = await parseInvokeError(fnError);
        if (bodyError) {
          showAlert('Atenção', bodyError);
          setLoading(false);
          return;
        }
        throw fnError;
      }

      navigation.navigate('VerifyEmail', {
        email: emailNormalized,
        password,
        fullName: fullName.trim(),
        phone: phoneDigits,
        ...(registrationType && { registrationType }),
      });
    } catch (err: unknown) {
      showAlert('Atenção', getUserErrorMessage(err, 'Não foi possível enviar o código. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  const emailHintState = useMemo(() => {
    if (!emailTouched && emailStatus !== 'checking') return null;
    if (!emailNormalized) return null;
    if (emailStatus === 'format') return { kind: 'error', text: 'E-mail em formato inválido.' };
    if (emailStatus === 'checking') return { kind: 'muted', text: 'Verificando e-mail…' };
    if (emailStatus === 'taken')
      return {
        kind: 'error',
        text: emailStatusMsg ?? 'Este e-mail já está cadastrado.',
      };
    if (emailStatus === 'available') return { kind: 'ok', text: 'E-mail disponível.' };
    if (emailStatus === 'error')
      return {
        kind: 'muted',
        text: 'Não foi possível validar agora. Continuaremos ao clicar em Continuar.',
      };
    return null;
  }, [emailNormalized, emailStatus, emailStatusMsg, emailTouched]);

  const passwordHint = useMemo(() => {
    if (!passwordTouched || password.length === 0) return null;
    if (!passwordValid) {
      return { kind: 'error' as const, text: `Use no mínimo ${PASSWORD_MIN_LEN} caracteres.` };
    }
    return { kind: 'ok' as const, text: 'Senha ok.' };
  }, [password, passwordTouched, passwordValid]);

  const confirmHint = useMemo(() => {
    if (!confirmTouched || confirmPassword.length === 0) return null;
    if (!passwordsMatch) return { kind: 'error' as const, text: 'As senhas não coincidem.' };
    return { kind: 'ok' as const, text: 'Senhas coincidem.' };
  }, [confirmPassword, confirmTouched, passwordsMatch]);

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
        <Text style={styles.titleHint}>
          {driverFirst
            ? 'Na próxima etapa você completará seu cadastro com documentos e informações adicionais.'
            : 'E-mail e senha serão confirmados após você completar o cadastro na próxima tela.'}
        </Text>

        {!driverFirst ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Nome e sobrenome"
              placeholderTextColor="#9CA3AF"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder="(00) 00000-0000"
              placeholderTextColor="#9CA3AF"
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
            />
          </>
        ) : null}

        <View style={styles.fieldGroup}>
          <TextInput
            style={[
              styles.input,
              styles.inputWithHint,
              emailHintState?.kind === 'error' ? styles.inputError : null,
              emailHintState?.kind === 'ok' ? styles.inputOk : null,
            ]}
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            onBlur={handleEmailBlur}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          {emailHintState && (
            <View style={styles.hintRow}>
              {emailStatus === 'checking' ? (
                <ActivityIndicator size="small" color="#6B7280" style={styles.hintSpinner} />
              ) : null}
              <Text
                style={[
                  styles.hintText,
                  emailHintState.kind === 'error' && styles.hintError,
                  emailHintState.kind === 'ok' && styles.hintOk,
                ]}
              >
                {emailHintState.text}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.passwordRow}>
            <TextInput
              style={[
                styles.input,
                styles.inputPassword,
                styles.inputWithHint,
                passwordHint?.kind === 'error' ? styles.inputError : null,
                passwordHint?.kind === 'ok' ? styles.inputOk : null,
              ]}
              placeholder={`Senha (mín. ${PASSWORD_MIN_LEN} caracteres)`}
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              onBlur={handlePasswordBlur}
              secureTextEntry={hidePassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setHidePassword((v) => !v)}>
              <MaterialIcons name={hidePassword ? 'visibility' : 'visibility-off'} size={22} color="#6B7280" style={styles.eyeIconCenter} />
            </TouchableOpacity>
          </View>
          {passwordHint && (
            <Text
              style={[
                styles.hintText,
                passwordHint.kind === 'error' && styles.hintError,
                passwordHint.kind === 'ok' && styles.hintOk,
              ]}
            >
              {passwordHint.text}
            </Text>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.passwordRow}>
            <TextInput
              style={[
                styles.input,
                styles.inputPassword,
                styles.inputWithHint,
                confirmHint?.kind === 'error' ? styles.inputError : null,
                confirmHint?.kind === 'ok' ? styles.inputOk : null,
              ]}
              placeholder="Confirme a senha"
              placeholderTextColor="#9CA3AF"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onBlur={handleConfirmBlur}
              secureTextEntry={hideConfirm}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setHideConfirm((v) => !v)}>
              <MaterialIcons name={hideConfirm ? 'visibility' : 'visibility-off'} size={22} color="#6B7280" style={styles.eyeIconCenter} />
            </TouchableOpacity>
          </View>
          {confirmHint && (
            <Text
              style={[
                styles.hintText,
                confirmHint.kind === 'error' && styles.hintError,
                confirmHint.kind === 'ok' && styles.hintOk,
              ]}
            >
              {confirmHint.text}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.continueButton, (!formReadyToSubmit || loading) && styles.continueButtonDisabled]}
          activeOpacity={0.8}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.continueButtonText}>Continuar</Text>}
        </TouchableOpacity>

        {!driverFirst ? (
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
        ) : null}
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
  title: { fontSize: 24, fontWeight: '700', color: '#000000', marginTop: 32, marginBottom: 8, lineHeight: 28, textAlign: 'center' },
  titleHint: { fontSize: 13, color: '#6B7280', marginBottom: 24, textAlign: 'center', paddingHorizontal: 8 },
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
  inputWithHint: { marginBottom: 6 },
  inputError: { borderColor: '#DC2626' },
  inputOk: { borderColor: '#059669' },
  fieldGroup: { marginBottom: 10 },
  passwordRow: { position: 'relative', marginBottom: 0 },
  inputPassword: { paddingRight: 48 },
  eyeButton: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  eyeIconCenter: { marginTop: -3 },
  hintRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingHorizontal: 4 },
  hintSpinner: { marginRight: 6 },
  hintText: { fontSize: 12, color: '#6B7280', marginBottom: 6, paddingHorizontal: 4 },
  hintError: { color: '#DC2626' },
  hintOk: { color: '#059669' },
  continueButton: { backgroundColor: '#000000', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8, marginBottom: 24 },
  continueButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  continueButtonDisabled: { opacity: 0.5 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  checkboxTouch: { marginRight: 12, marginTop: 2 },
  checkboxLabelWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#000000', borderColor: '#000000' },
  checkmark: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
  checkboxLabelInline: { fontSize: 14, color: '#374151', lineHeight: 20 },
  link: { color: '#2563EB', fontWeight: '600' },
});
