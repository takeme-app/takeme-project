import { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackTypes';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAppAlert } from '../../contexts/AppAlertContext';
import { getUserErrorMessage } from '../../utils/errorMessage';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditEmail'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral700: '#767676',
};

export function EditEmailScreen({ navigation }: Props) {
  const { showAlert } = useAppAlert();
  const [email, setEmail] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email ?? '';
      setEmail(userEmail);
      setCurrentEmail(userEmail);
      setInitialLoading(false);
    })();
  }, []);

  // Atualiza o e-mail exibido quando a sessão muda (ex.: confirmação pelo link abre o app)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const userEmail = session?.user?.email ?? '';
      if (userEmail) {
        setEmail(userEmail);
        setCurrentEmail(userEmail);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleUpdate = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      showAlert('Erro', 'Informe um e-mail válido.');
      return;
    }
    if (trimmed.toLowerCase() === currentEmail.toLowerCase()) {
      showAlert('Atenção', 'O e-mail informado é o mesmo da sua conta. Não é necessário atualizar.');
      return;
    }
    setLoading(true);
    const scheme = process.env.EXPO_PUBLIC_APP_SCHEME ?? 'take-me-cliente';
    const emailRedirectTo = `${scheme}://auth/confirm`;
    const { error } = await supabase.auth.updateUser(
      { email: trimmed },
      { emailRedirectTo }
    );
    setLoading(false);
    if (error) {
      const msg = getUserErrorMessage(error, 'Não foi possível atualizar o e-mail.');
      const isEmailAlreadyUsed =
        /already exists|already registered|user already registered|duplicate|23505|unique/i.test(String(error?.message ?? ''));
      if (isEmailAlreadyUsed) {
        showAlert('Atenção', 'Este e-mail já está cadastrado. Use outro e-mail.');
      } else {
        showAlert('Erro', msg);
      }
      return;
    }
    navigation.goBack();
  };

  if (initialLoading) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.keyboard} behavior="padding">
        <View style={styles.dialog}>
          <View style={styles.headerRow}>
            <View style={styles.headerSpacer} />
            <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <MaterialIcons name="close" size={22} color={COLORS.neutral700} />
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>Atualize seu e-mail</Text>
          <Text style={styles.hint}>Use um e-mail válido. Ele será utilizado para notificações e recuperação de conta.</Text>
          <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="seu@email.com"
          placeholderTextColor={COLORS.neutral700}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleUpdate}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Atualizar</Text>}
        </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboard: { flex: 1 },
  dialog: { flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8 },
  headerSpacer: { flex: 1 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.black, marginBottom: 12 },
  hint: { fontSize: 14, color: COLORS.neutral700, marginBottom: 24 },
  label: { fontSize: 15, fontWeight: '500', color: COLORS.black, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.black,
    marginBottom: 20,
  },
  button: {
    backgroundColor: COLORS.black,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
