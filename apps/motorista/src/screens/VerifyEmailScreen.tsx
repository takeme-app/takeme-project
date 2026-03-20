import { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
  Dimensions,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Text } from '../components/Text';
import { useAppAlert } from '../contexts/AppAlertContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, DriverType } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { getUserErrorMessage } from '../utils/errorMessage';
import { parseInvokeData, parseInvokeError } from '../utils/edgeFunctionResponse';
import { useDeferredDriverSignup } from '../contexts/DeferredDriverSignupContext';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

const CODE_LENGTH = 4;
const OTP_GAP = 10;
const CONTENT_PADDING = 48;

function getOtpBoxSize(): number {
  const { width } = Dimensions.get('window');
  const available = width - CONTENT_PADDING;
  const boxSize = (available - OTP_GAP * 3) / 4;
  return Math.min(85, Math.max(52, Math.floor(boxSize)));
}

export function VerifyEmailScreen({ navigation, route }: Props) {
  const { email, password, fullName: fullNameParam, phone: phoneParam, registrationType } = route.params;
  const fullName = fullNameParam ?? '';
  const phone = phoneParam ?? '';
  const driverType: DriverType | undefined =
    registrationType === 'take_me' || registrationType === 'parceiro' ? registrationType : undefined;
  const { showAlert } = useAppAlert();
  const { setDeferred } = useDeferredDriverSignup();
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const code = digits.join('');
  const isComplete = code.length === CODE_LENGTH;
  const otpBoxSize = getOtpBoxSize();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const t = setTimeout(() => inputRefs.current[0]?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  const setDigit = (index: number, value: string) => {
    const onlyNums = value.replace(/\D/g, '');
    if (onlyNums.length > 1) {
      const arr = onlyNums.slice(0, CODE_LENGTH).split('');
      const next = [...digits];
      arr.forEach((c, i) => { next[i] = c; });
      setDigits(next);
      const lastIdx = Math.min(arr.length, CODE_LENGTH) - 1;
      setFocusedIndex(lastIdx);
      setTimeout(() => inputRefs.current[lastIdx]?.focus(), 50);
      return;
    }
    const num = onlyNums.slice(-1);
    const next = [...digits];
    next[index] = num;
    setDigits(next);
    if (num && index < CODE_LENGTH - 1) {
      setFocusedIndex(index + 1);
      setTimeout(() => inputRefs.current[index + 1]?.focus(), 50);
    }
  };

  const handleKeyPress = (index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      setFocusedIndex(index - 1);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleConfirm = async () => {
    if (!isComplete) return;
    setLoading(true);
    try {
      const deferCreate = Boolean(driverType);
      const { data: fnData, error: fnError } = await supabase.functions.invoke('verify-email-code', {
        body: {
          email: email.trim(),
          code,
          password,
          fullName,
          phone,
          /** Sempre booleano: motorista não cria conta no Auth nesta etapa. */
          defer_create: deferCreate,
        },
      });

      const payload = parseInvokeData(fnData);

      if (fnError) {
        const bodyError = await parseInvokeError(fnError);
        const message = bodyError ?? getUserErrorMessage(fnError, 'Código inválido ou expirado. Tente novamente.');
        showAlert('Código incorreto', message);
        setLoading(false);
        return;
      }

      if (payload?.error != null) {
        showAlert('Código incorreto', String(payload.error));
        setLoading(false);
        return;
      }

      if (deferCreate) {
        const token = payload?.token;
        if (driverType && typeof token === 'string' && token.length > 0) {
          setDeferred({
            verificationToken: token,
            email: email.trim().toLowerCase(),
            password,
            driverType,
          });
          navigation.reset({
            index: 0,
            routes: [{ name: 'CompleteDriverRegistration', params: { driverType } }],
          });
        } else {
          showAlert(
            'Cadastro motorista',
            'O servidor confirmou o código, mas não devolveu o token de continuação. Faça o deploy da função verify-email-code mais recente e defina DRIVER_DEFERRED_SIGNUP_SECRET (ou SUPABASE_JWT_SECRET com 16+ caracteres) no Supabase.\n\nSe você já recebeu e-mail de boas-vindas, esse e-mail pode ter sido cadastrado antes — use outro e-mail ou faça login.'
          );
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }
    } catch (err: unknown) {
      showAlert('Código incorreto', getUserErrorMessage(err, 'Código inválido ou expirado. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    try {
      const { data: resendData, error: fnError } = await supabase.functions.invoke('send-email-verification-code', {
        body: { email: email.trim() },
      });
      const resendPayload = parseInvokeData(resendData);
      if (resendPayload?.error != null) {
        showAlert('Erro', String(resendPayload.error));
        return;
      }
      if (fnError) {
        const bodyError = await parseInvokeError(fnError);
        showAlert(
          'Erro',
          bodyError ?? getUserErrorMessage(fnError, 'Não foi possível reenviar o código.')
        );
        return;
      }
      setDigits(['', '', '', '']);
      setFocusedIndex(0);
      inputRefs.current[0]?.focus();
    } catch (err: unknown) {
      showAlert('Erro', getUserErrorMessage(err, 'Não foi possível reenviar o código.'));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
        <StatusBar style="dark" />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          <View style={[styles.content, { paddingTop: insets.top + 96 }]}>
            <Text style={styles.title}>Confirme seu e-mail</Text>
            <Text style={styles.subtitle}>Digite o código de 4 dígitos enviado para seu e-mail.</Text>

            <View style={styles.otpWrapper}>
              {[0, 1, 2, 3].map((index) => {
                const isFocused = focusedIndex === index;
                return (
                  <TextInput
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    style={[
                      styles.otpInput,
                      {
                        width: otpBoxSize,
                        height: otpBoxSize,
                        borderRadius: otpBoxSize / 2,
                        marginHorizontal: OTP_GAP / 2,
                        fontSize: Math.round(otpBoxSize * 0.4),
                      },
                      isFocused ? styles.otpInputFocused : styles.otpInputDefault,
                    ]}
                    value={digits[index]}
                    onChangeText={(v) => setDigit(index, v)}
                    onKeyPress={(e) => handleKeyPress(index, e)}
                    onFocus={() => setFocusedIndex(index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    autoFocus={index === 0}
                  />
                );
              })}
            </View>

            <TouchableOpacity style={styles.resendLink} onPress={handleResendCode} disabled={resendLoading}>
              {resendLoading ? <ActivityIndicator size="small" color="#2563EB" /> : <Text style={styles.resendLinkText}>Reenviar código</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
          <TouchableOpacity style={styles.footerBackButton} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.footerBack}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmButton, isComplete && styles.confirmButtonActive, loading && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={!isComplete || loading}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[styles.confirmButtonText, isComplete && styles.confirmButtonTextActive]}>Confirmar</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  content: { paddingHorizontal: 24, alignItems: 'center' },
  title: { color: '#0D0D0D', textAlign: 'center', fontSize: 24, fontWeight: '600', marginBottom: 8 },
  subtitle: { color: '#767676', textAlign: 'center', fontSize: 14, lineHeight: 21, marginBottom: 32 },
  otpWrapper: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
  otpInput: { fontWeight: '700', color: '#0D0D0D', textAlign: 'center', padding: 0 },
  otpInputDefault: { backgroundColor: '#F1F1F1', borderWidth: 0 },
  otpInputFocused: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#0D0D0D' },
  resendLink: { paddingVertical: 8, alignSelf: 'center' },
  resendLinkText: { fontSize: 14, fontWeight: '500', color: '#2563EB' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 24 },
  footerBackButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  footerBack: { fontSize: 22, color: '#000000', fontWeight: '600' },
  confirmButton: { backgroundColor: '#E5E7EB', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, minWidth: 160 },
  confirmButtonActive: { backgroundColor: '#0D0D0D' },
  confirmButtonDisabled: { opacity: 1 },
  confirmButtonText: { fontSize: 16, fontWeight: '600', color: '#9CA3AF' },
  confirmButtonTextActive: { color: '#FFFFFF' },
});
