import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type Props = {
  onBack: () => void;
  onEmailSent?: (email: string) => void;
};

export function ForgotPasswordScreen({ onBack, onEmailSent }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const trimmed = email.trim();
    setError('');
    if (!trimmed) {
      setError('Digite seu e-mail.');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Serviço não configurado. Verifique as variáveis do Supabase.');
      return;
    }
    setLoading(true);
    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
      const { error: err } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });
      if (err) throw err;
      setSent(true);
      onEmailSent?.(trimmed);
    } catch {
      setError('Não foi possível enviar o e-mail. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {Platform.OS !== 'web' && <StatusBar style="light" />}
      <View style={styles.card}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} disabled={loading}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Recuperação de senha</Text>
        <Text style={styles.subtitle}>
          Digite seu e-mail e enviaremos um link para redefinir sua senha.
        </Text>

        {sent ? (
          <Text style={styles.sentText}>Verifique seu e-mail. Enviamos um link de recuperação.</Text>
        ) : (
          <>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              placeholder="E-mail"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError('');
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              activeOpacity={0.8}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Enviar link de recuperação</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F1F1F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 400,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 20,
    padding: 4,
  },
  backArrow: {
    fontSize: 22,
    color: '#000000',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    marginBottom: 4,
  },
  inputError: {
    borderColor: '#DC2626',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginBottom: 12,
  },
  sentText: {
    fontSize: 15,
    color: '#059669',
    lineHeight: 22,
  },
  submitButton: {
    backgroundColor: '#0D0D0D',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
