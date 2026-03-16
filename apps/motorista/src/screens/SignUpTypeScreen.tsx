import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Text } from '../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, DriverType } from '../navigation/types';
import { MaterialIcons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUpType'>;

export function SignUpTypeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<DriverType | null>(null);

  const handleNext = () => {
    if (!selected) return;
    navigation.navigate('SignUp', { driverType: selected });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Crie sua conta</Text>
        <Text style={styles.subtitle}>Escolha seu tipo de cadastro para começar.</Text>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.iconWrap}>
              <MaterialIcons name="directions-car" size={24} color="#6B7280" />
            </View>
            <Text style={styles.sectionTitle}>Motorista</Text>
          </View>
          <Text style={styles.sectionDesc}>Dirija com a Take Me e receba corridas diretamente pelo app.</Text>

          <TouchableOpacity
            style={[styles.optionCard, selected === 'take_me' && styles.optionCardSelected]}
            onPress={() => setSelected('take_me')}
            activeOpacity={0.8}
          >
            <View style={[styles.radio, selected === 'take_me' && styles.radioSelected]}>
              {selected === 'take_me' && <View style={styles.radioInner} />}
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>Motorista Take Me</Text>
              <Text style={styles.optionDesc}>Motorista vinculado diretamente à Take Me.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, selected === 'parceiro' && styles.optionCardSelected]}
            onPress={() => setSelected('parceiro')}
            activeOpacity={0.8}
          >
            <View style={[styles.radio, selected === 'parceiro' && styles.radioSelected]}>
              {selected === 'parceiro' && <View style={styles.radioInner} />}
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>Motorista Parceiro</Text>
              <Text style={styles.optionDesc}>Trabalha com frota ou empresa parceira.</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.nextButton, !selected && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!selected}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>Próximo</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7280', marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  iconWrap: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  sectionDesc: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: { borderColor: '#000000', backgroundColor: '#F3F4F6' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  radioSelected: { borderColor: '#000000' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#000000' },
  optionTextWrap: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 2 },
  optionDesc: { fontSize: 13, color: '#6B7280' },
  nextButton: { backgroundColor: '#000000', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  nextButtonDisabled: { backgroundColor: '#9CA3AF', opacity: 0.8 },
  nextButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
