import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

const CODE_LENGTH = 4;

export function VerifyEmailScreen({ navigation, route }: Props) {
  const { email, password, fullName, phone } = route.params;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const digits = code.padEnd(CODE_LENGTH, '').split('');
  const isComplete = code.length === CODE_LENGTH;

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const handleChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(cleaned);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!isComplete) return;
    setError(null);
    setLoading(true);
    try {
      const { error: fnError } = await supabase.functions.invoke('verify-email-code', {
        body: { email, code, password, fullName, phone },
      });
      if (fnError) throw fnError;

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      navigation.navigate('AddPaymentPrompt');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Código inválido ou expirado. Tente novamente.';
      setError(message);
      Alert.alert('Erro', message);
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
      setCode('');
      inputRef.current?.focus();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Não foi possível reenviar o código.';
      setError(message);
      Alert.alert('Erro', message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Vamos confirmar seu e-mail</Text>
        <Text style={styles.subtitle}>
          Enviamos um código para seu e-mail. Digite abaixo para confirmar.
        </Text>

        <View style={styles.otpWrapper}>
          <TouchableOpacity
            style={styles.otpRow}
            onPress={() => inputRef.current?.focus()}
            activeOpacity={1}
          >
            {digits.map((digit, index) => {
              const filled = !!digit;
              const emptyFocused = !filled && index === code.length;
              const filledLast = filled && index === code.length - 1;
              const filledPrev = filled && index < code.length - 1;
              return (
                <View
                  key={index}
                  style={[
                    styles.otpCircle,
                    emptyFocused && styles.otpCircleEmptyFocused,
                    filledLast && styles.otpCircleFilledLast,
                    filledPrev && styles.otpCircleFilledPrev,
                    !filled && !emptyFocused && styles.otpCircleEmpty,
                  ]}
                >
                  <Text
                    style={[
                      styles.otpDigit,
                      filledLast && styles.otpDigitWhite,
                      filledPrev && styles.otpDigitBlack,
                      emptyFocused && !digit && styles.otpDigitWhite,
                    ]}
                  >
                    {digit || '\u200B'}
                  </Text>
                </View>
              );
            })}
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={code}
            onChangeText={handleChange}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            autoFocus
          />
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

      <View style={styles.footer}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    marginTop: 60,
    marginBottom: 8,
  },
  backArrow: {
    fontSize: 22,
    color: '#000000',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    paddingTop: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  otpWrapper: {
    height: 64,
    marginBottom: 24,
    position: 'relative',
  },
  otpRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 64,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpCircle: {
    width: 64,
    height: 64,
    minWidth: 64,
    minHeight: 64,
    marginHorizontal: 8,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
    borderColor: '#9CA3AF',
    opacity: 1,
  },
  otpCircleEmpty: {
    borderColor: '#9CA3AF',
    backgroundColor: '#E5E7EB',
  },
  otpCircleEmptyFocused: {
    borderColor: '#000000',
    backgroundColor: '#000000',
  },
  otpCircleFilledLast: {
    borderColor: '#000000',
    backgroundColor: '#000000',
  },
  otpCircleFilledPrev: {
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  otpDigit: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
  },
  otpDigitWhite: {
    color: '#FFFFFF',
  },
  otpDigitBlack: {
    color: '#000000',
  },
  hiddenInput: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    opacity: 0,
    zIndex: -1,
  },
  resendLink: {
    paddingVertical: 8,
  },
  resendLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563EB',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 48,
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
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  confirmButtonActive: {
    backgroundColor: '#000000',
  },
  confirmButtonDisabled: {
    opacity: 0.8,
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
