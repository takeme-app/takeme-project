import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hidePassword, setHidePassword] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const input = phoneOrEmail.trim();
    if (!input) {
      Alert.alert('Atenção', 'Digite seu e-mail ou telefone.');
      return;
    }
    if (!password) {
      Alert.alert('Atenção', 'Digite sua senha.');
      return;
    }
    if (!isSupabaseConfigured) {
      Alert.alert(
        'Configuração',
        'Login não configurado. Verifique as variáveis do Supabase no .env.'
      );
      return;
    }
    setLoading(true);
    try {
      const isEmail = input.includes('@');

      if (isEmail) {
        const { error } = await supabase.auth.signInWithPassword({
          email: input,
          password,
        });
        if (error) throw error;
      } else {
        const phoneDigits = input.replace(/\D/g, '');
        const { data, error: fnError } = await supabase.functions.invoke('login-with-phone', {
          body: { phone: phoneDigits, password },
        });
        if (fnError) throw fnError;
        const errMsg = data?.error;
        if (errMsg) throw new Error(errMsg);
        if (!data?.session) throw new Error('Resposta inválida.');
        await supabase.auth.setSession(data.session);
      }

      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } catch (e: unknown) {
      const isNetworkError =
        e instanceof TypeError && (e.message === 'Network request failed' || e.message?.includes('Network request failed'));
      const msg = isNetworkError
        ? 'Sem conexão com a internet ou servidor temporariamente indisponível. Verifique sua rede e tente novamente.'
        : e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'Não foi possível entrar. Verifique e-mail/senha ou telefone/senha.';
      Alert.alert(isNetworkError ? 'Erro de conexão' : 'Erro no login', msg);
    } finally {
      setLoading(false);
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
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Digite seu número de telefone ou email</Text>

      <TextInput
        style={styles.input}
        placeholder="Telefone ou email"
        placeholderTextColor="#9CA3AF"
        value={phoneOrEmail}
        onChangeText={setPhoneOrEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <View style={styles.passwordRow}>
        <TextInput
          style={[styles.input, styles.inputPassword]}
          placeholder="Senha de acesso"
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={hidePassword}
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setHidePassword((v) => !v)}
        >
          <View style={styles.eyeIconWrap}>
            <MaterialIcons
              name={hidePassword ? 'visibility' : 'visibility-off'}
              size={22}
              color="#6B7280"
              style={styles.eyeIconCenter}
            />
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.continueButton, loading && styles.continueButtonDisabled]}
        activeOpacity={0.8}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.continueButtonText}>Continuar</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.forgotLink}
        onPress={() => navigation.navigate('ForgotPassword')}
      >
        <Text style={styles.forgotLinkText}>Esqueceu sua senha?</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
        <Text style={styles.socialIcon}>G</Text>
        <Text style={styles.socialButtonText}>Continuar com Google</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
        <Text style={styles.socialIcon}></Text>
        <Text style={styles.socialButtonText}>Continuar com Apple</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
        <Text style={styles.socialIcon}>✉</Text>
        <Text style={styles.socialButtonText}>Continuar com Email</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
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
    marginBottom: 24,
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
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
    marginBottom: 16,
  },
  passwordRow: {
    position: 'relative',
    marginBottom: 0,
  },
  inputPassword: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIconWrap: {
    height: 24,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIconCenter: {
    marginTop: -3,
  },
  continueButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 32,
  },
  forgotLinkText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  socialIcon: {
    fontSize: 20,
    marginRight: 12,
    color: '#000000',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
});
