import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackTypes';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAppAlert } from '../../contexts/AppAlertContext';
import { getUserErrorMessage } from '../../utils/errorMessage';

type Props = NativeStackScreenProps<ProfileStackParamList, 'DeleteCard'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral700: '#767676',
  danger: '#DC2626',
};

export function DeleteCardScreen({ navigation, route }: Props) {
  const { paymentMethodId } = route.params;
  const { showAlert } = useAppAlert();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    const { error } = await supabase.from('payment_methods').delete().eq('id', paymentMethodId);
    setLoading(false);
    if (error) {
      showAlert('Erro', getUserErrorMessage(error, 'Não foi possível excluir o cartão.'));
      return;
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.dialog}>
        <View style={styles.headerRow}>
          <View style={styles.headerSpacer} />
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <MaterialIcons name="close" size={22} color={COLORS.neutral700} />
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Tem certeza de que deseja remover este cartão da carteira?</Text>
        <Text style={styles.body}>Essa ação não pode ser desfeita.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>Manter cartão</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.destructiveButton, loading && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color={COLORS.danger} /> : <Text style={styles.destructiveButtonText}>Excluir cartão</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  dialog: { flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  headerSpacer: { flex: 1 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 16,
    paddingRight: 8,
  },
  body: {
    fontSize: 15,
    color: COLORS.neutral700,
    lineHeight: 22,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  destructiveButton: {
    backgroundColor: COLORS.neutral300,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  destructiveButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.danger },
});
