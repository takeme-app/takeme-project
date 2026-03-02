import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TripStackParamList, 'WhenNeeded'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

export function WhenNeededScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<'now' | 'later' | null>(null);

  const handleContinue = () => {
    if (selected === 'now') {
      navigation.navigate('SearchTrip', { immediateTrip: true });
    } else if (selected === 'later') {
      navigation.navigate('PlanRide');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.getParent()?.goBack()}
        activeOpacity={0.7}
      >
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Para quando você precisa da viagem?</Text>

      <TouchableOpacity
        style={[styles.optionCard, selected === 'now' && styles.optionCardSelected]}
        onPress={() => setSelected('now')}
        activeOpacity={0.8}
      >
        <View style={styles.optionIconWrap}>
          <MaterialIcons name="schedule" size={28} color={COLORS.black} />
        </View>
        <View style={styles.optionTextWrap}>
          <Text style={styles.optionLabel}>Agora</Text>
          <Text style={styles.optionSubtitle}>Chame um carro imediatamente</Text>
        </View>
        <View style={[styles.radio, selected === 'now' && styles.radioSelected]}>
          {selected === 'now' && <View style={styles.radioInner} />}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.optionCard, selected === 'later' && styles.optionCardSelected]}
        onPress={() => setSelected('later')}
        activeOpacity={0.8}
      >
        <View style={styles.optionIconWrap}>
          <MaterialIcons name="event" size={28} color={COLORS.black} />
        </View>
        <View style={styles.optionTextWrap}>
          <Text style={styles.optionLabel}>Mais tarde</Text>
          <Text style={styles.optionSubtitle}>Agende para o horário que preferir</Text>
        </View>
        <View style={[styles.radio, selected === 'later' && styles.radioSelected]}>
          {selected === 'later' && <View style={styles.radioInner} />}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.continueButton, !selected && styles.continueButtonDisabled]}
        onPress={handleContinue}
        disabled={!selected}
        activeOpacity={0.8}
      >
        <Text style={styles.continueButtonText}>Continuar</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  backArrow: {
    fontSize: 22,
    color: COLORS.black,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 24,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  optionCardSelected: {
    borderColor: COLORS.black,
  },
  optionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  optionSubtitle: {
    fontSize: 14,
    color: COLORS.neutral700,
    marginTop: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.neutral400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: COLORS.black,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.black,
  },
  continueButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 32,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
