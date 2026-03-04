import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Text } from '../../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ActivitiesStackParamList } from '../../navigation/ActivitiesStackTypes';
import { supabase } from '../../lib/supabase';

type Props = NativeStackScreenProps<ActivitiesStackParamList, 'ShipmentTip'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral700: '#767676',
};

/** Valor em centavos armazenado como string para edição (ex: "1500" = R$ 15,00) */
function formatCentsToBRL(cents: number): string {
  const reais = cents / 100;
  return reais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ShipmentTipScreen({ navigation, route }: Props) {
  const shipmentId = route.params?.shipmentId ?? '';
  const [valueCents, setValueCents] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const displayValue = formatCentsToBRL(valueCents);

  const onDigit = (d: number) => {
    setValueCents((prev) => Math.min(999999, prev * 10 + d));
  };

  const onBackspace = () => {
    setValueCents((prev) => Math.floor(prev / 10));
  };

  const handleSubmit = async () => {
    if (valueCents <= 0) {
      Alert.alert('Valor inválido', 'Digite um valor maior que zero.');
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      return;
    }
    const { error } = await supabase
      .from('shipments')
      .update({ tip_cents: valueCents })
      .eq('id', shipmentId)
      .eq('user_id', user.id);
    setSubmitting(false);
    if (error) {
      Alert.alert('Erro', 'Não foi possível enviar a gorjeta. Tente novamente.');
      return;
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="close" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gorjeta</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.valueLabel}>Valor</Text>
        <Text style={styles.valueDisplay}>R$ {displayValue}</Text>

        <View style={styles.keypad}>
          {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row, rowIndex) => (
            <View key={rowIndex} style={styles.keypadRow}>
              {row.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={styles.keypadKey}
                  onPress={() => onDigit(d)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.keypadKeyText}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={styles.keypadRow}>
            <TouchableOpacity style={styles.keypadKey} onPress={() => onDigit(0)} activeOpacity={0.7}>
              <Text style={styles.keypadKeyText}>0</Text>
            </TouchableOpacity>
            <View style={styles.keypadKeyPlaceholder} />
            <TouchableOpacity style={styles.keypadKey} onPress={onBackspace} activeOpacity={0.7}>
              <MaterialIcons name="backspace" size={24} color={COLORS.black} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, (valueCents <= 0 || submitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={valueCents <= 0 || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Enviar gorjeta</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral300,
  },
  closeButton: { padding: 4, width: 32 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.black, flex: 1, textAlign: 'center' },
  headerSpacer: { width: 32 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  valueLabel: { fontSize: 14, color: COLORS.neutral700, marginBottom: 8 },
  valueDisplay: { fontSize: 32, fontWeight: '700', color: COLORS.black, marginBottom: 32 },
  keypad: { gap: 12 },
  keypadRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  keypadKey: {
    width: 72,
    height: 56,
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadKeyText: { fontSize: 22, fontWeight: '600', color: COLORS.black },
  keypadKeyPlaceholder: { width: 72, height: 56 },
  submitButton: {
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: COLORS.black,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
