import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getLastRecoveryEmail } from '../lib/lastRecoveryEmail';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPasswordEmailSent'>;

const RESEND_COOLDOWN_SEC = 60;

export function ForgotPasswordEmailSentScreen({ navigation, route }: Props) {
  const email = (route.params?.email ?? getLastRecoveryEmail()).trim();
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN_SEC);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const canResend = countdown <= 0 && !resendLoading;

  const handleResend = async () => {
    if (!email.trim() || !isSupabaseConfigured) {
      if (!email.trim()) Alert.alert('Atenção', 'E-mail não disponível para reenvio.');
      return;
    }
    setResendLoading(true);
    try {
      const redirectTo = process.env.EXPO_PUBLIC_APP_SCHEME
        ? `${process.env.EXPO_PUBLIC_APP_SCHEME}://reset-password`
        : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        ...(redirectTo && { redirectTo }),
      });
      if (error) throw error;
      setCountdown(RESEND_COOLDOWN_SEC);
    } catch (e: unknown) {
      const message =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'Não foi possível reenviar o e-mail. Tente novamente.';
      Alert.alert('Erro', message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.checkmark}>✓</Text>
        </View>
        <Text style={styles.message}>
          Um link de recuperação foi enviado para o seu email
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.resendButton, !canResend && styles.resendButtonDisabled]}
          onPress={handleResend}
          disabled={!canResend}
          activeOpacity={0.8}
        >
          {resendLoading ? (
            <ActivityIndicator size="small" color="#374151" />
          ) : (
            <Text
              style={[
                styles.resendButtonText,
                !canResend && styles.resendButtonTextDisabled,
              ]}
            >
              {canResend ? 'Reenviar email' : `Reenviar email (${countdown}s)`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  backArrow: {
    fontSize: 22,
    color: '#000000',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  checkmark: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  message: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  footer: {
    paddingBottom: 48,
    alignItems: 'center',
  },
  resendButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  resendButtonDisabled: {
    opacity: 0.7,
  },
  resendButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  resendButtonTextDisabled: {
    color: '#9CA3AF',
  },
});
