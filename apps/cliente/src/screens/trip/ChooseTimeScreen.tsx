import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Text } from '../../components/Text';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripStackParamList } from '../../navigation/types';
import { getDateCarouselOptions } from '../../lib/dateTimeSlots';

type Props = NativeStackScreenProps<TripStackParamList, 'ChooseTime'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

const DAY_OPTIONS = getDateCarouselOptions();

export function ChooseTimeScreen({ navigation }: Props) {
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  const handleSelect = () => {
    if (selectedDayId) {
      navigation.navigate('PlanRide', { scheduledDateId: selectedDayId });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Escolha o dia</Text>

      <ScrollView style={styles.slotsScroll} contentContainerStyle={styles.slotsContent}>
        {DAY_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={styles.slotRow}
            onPress={() => setSelectedDayId(opt.id)}
            activeOpacity={0.7}
          >
            <View>
              <Text style={styles.slotText}>{opt.dayLabel}</Text>
              <Text style={styles.daySubLabel}>{opt.dateLabel}</Text>
            </View>
            <View style={[styles.radio, selectedDayId === opt.id && styles.radioSelected]}>
              {selectedDayId === opt.id && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, !selectedDayId && styles.primaryButtonDisabled]}
          onPress={handleSelect}
          disabled={!selectedDayId}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Selecionar dia</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.black,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  slotsScroll: { flex: 1 },
  slotsContent: { paddingHorizontal: 24, paddingBottom: 24 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral300,
  },
  slotText: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  daySubLabel: { fontSize: 13, color: COLORS.neutral700, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.neutral400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: COLORS.black },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.black,
  },
  footer: { padding: 24, paddingBottom: 32 },
  primaryButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  cancelButton: { paddingVertical: 12, alignItems: 'center' },
  cancelButtonText: { fontSize: 16, fontWeight: '500', color: COLORS.neutral700 },
});
