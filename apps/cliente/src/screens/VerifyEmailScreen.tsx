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
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Text } from '../components/Text';
import { useAppAlert } from '../contexts/AppAlertContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { assertClientePassengerOnlyAccount } from '../lib/clientePassengerOnlyGate';
import { getUserErrorMessage } from '../utils/errorMessage';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

const CODE_LENGTH = 4;
const OTP_BOX_DESKTOP = 85;
const OTP_GAP = 10;
const CONTENT_PADDING = 48; // 24 * 2

function getOtpBoxSize(): number {
  const { width } = Dimensions.get('window');
  const available = width - CONTENT_PADDING;
  const boxSize = (available - OTP_GAP * (CODE_LENGTH - 1)) / CODE_LENGTH;
  return Math.min(OTP_BOX_DESKTOP, Math.max(34, Math.floor(boxSize)));
}

export function VerifyEmailScreen({ navigation, route }: Props) {
  const { email, password, fullName, phone } = route.params;
  const { showAlert } = useAppAlert();
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length: CODE_LENGTH }, () => ''));
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const code = digits.join('');
  const isComplete = code.length === CODE_LENGTH;
  const otpBoxSize = getOtpBoxSize();
  const insets = useSafeAreaInsets();
  const titleTopPadding = 96;

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
      setError(null);
      const lastIdx = Math.min(arr.length, CODE_LENGTH) - 1;
      setFocusedIndex(lastIdx);
      setTimeout(() => inputRefs.current[lastIdx]?.focus(), 50);
      return;
    }
    const num = onlyNums.slice(-1);
    const next = [...digits];
    next[index] = num;
    setDigits(next);
    setError(null);
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
    setError(null);
    setLoading(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('verify-email-code', {
        body: { email, code, password, fullName, phone },
      });

      if (fnError) {
        const err = fnError as unknown as {
          message?: string;
          context?: { json?: () => Promise<unknown>; body?: unknown };
        };
        let bodyError: string | null = null;
        if (err?.context && typeof (err.context as { json?: () => Promise<unknown> }).json === 'function') {
          try {
            const body = await (err.context as { json: () => Promise<Record<string, unknown>> }).json();
            if (body && typeof body === 'object' && body !== null && 'error' in body) {
              bodyError = String((body as { error: unknown }).error);
            }
          } catch (_) {
            /* ignorar falha ao parsear */
          }
        }
        if (!bodyError && err?.context?.body && typeof err.context.body === 'object' && err.context.body !== null && 'error' in (err.context.body as object)) {
          bodyError = String((err.context.body as { error: unknown }).error);
        }
        const message = bodyError ?? getUserErrorMessage(fnError, 'Código inválido ou expirado. Tente novamente.');
        setError(message);
        showAlert('Código incorreto', message);
        setLoading(false);
        return;
      }

      if (fnData?.error) {
        const message = String(fnData.error);
        setError(message);
        showAlert('Código incorreto', message);
        setLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        const message = getUserErrorMessage(
          signInError,
          'Não foi possível entrar após confirmar o e-mail. Tente fazer login manualmente.'
        );
        setError(message);
        showAlert('Login', message);
        return;
      }

      const { data: { session: postVerifySession } } = await supabase.auth.getSession();
      if (postVerifySession?.user) {
        const gate = await assertClientePassengerOnlyAccount(postVerifySession.user.id);
        if (!gate.ok) {
          await supabase.auth.signOut();
          showAlert('Acesso não permitido', gate.message);
          return;
        }
      }

      navigation.navigate('AddPaymentPrompt');
    } catch (err: unknown) {
      const message = getUserErrorMessage(err, 'Código inválido ou expirado. Tente novamente.');
      setError(message);
      showAlert('Código incorreto', message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError(null);
    setResendLoading(true);
    try {
      const { error: fnError } = await supabase.functions.invoke(
        'send-email-verification-code',
        { body: { email } }
      );
      if (fnError) throw fnError;
      setDigits(Array.from({ length: CODE_LENGTH }, () => ''));
      setFocusedIndex(0);
      inputRefs.current[0]?.focus();
    } catch (err: unknown) {
      const message = getUserErrorMessage(err, 'Não foi possível reenviar o código.');
      setError(message);
      showAlert('Erro', message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <StatusBar style="dark" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.content, { paddingTop: insets.top + titleTopPadding }]}>
            <Text style={styles.title}>Vamos confirmar seu e-mail</Text>
            <Text style={styles.subtitle}>
              Enviamos um código para seu e-mail.{'\n'}Digite abaixo para confirmar.
            </Text>

            <View style={styles.otpWrapper}>
              {Array.from({ length: CODE_LENGTH }, (_, index) => index).map((index) => {
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

            <TouchableOpacity
              style={styles.resendLink}
              onPress={handleResendCode}
              disabled={resendLoading}
            >
              {resendLoading ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <Text style={styles.resendLinkText}>Reenviar código por e-mail</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
          <TouchableOpacity
            style={styles.footerBackButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.footerBack}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              isComplete && styles.confirmButtonActive,
              loading && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!isComplete || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.confirmButtonText,
                  isComplete && styles.confirmButtonTextActive,
                ]}
              >
                Confirmar código
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    color: '#0D0D0D',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    color: '#767676',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
    marginBottom: 32,
  },
  otpWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  otpInput: {
    fontWeight: '700',
    color: '#0D0D0D',
    textAlign: 'center',
    padding: 0,
  },
  otpInputDefault: {
    backgroundColor: '#F1F1F1',
    borderWidth: 0,
  },
  otpInputFocused: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0D0D0D',
  },
  resendLink: {
    paddingVertical: 8,
    alignSelf: 'center',
  },
  resendLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563EB',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  footerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBack: {
    fontSize: 22,
    color: '#000000',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    minWidth: 160,
  },
  confirmButtonActive: {
    backgroundColor: '#0D0D0D',
  },
  confirmButtonDisabled: {
    opacity: 1,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  confirmButtonTextActive: {
    color: '#FFFFFF',
  },
});
