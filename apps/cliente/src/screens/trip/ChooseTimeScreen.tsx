import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TripStackParamList, 'ChooseTime'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

const DAY_TABS = [
  { id: 'hoje', label: 'Hoje Out 03' },
  { id: 'amanha', label: 'Amanhã Out 04' },
  { id: 'domingo', label: 'Domingo Out 05' },
];

const TIME_SLOTS = [
  '09:00 - 10:00',
  '10:00 - 10:30',
  '11:00 - 11:30',
  '12:00 - 12:30',
  '14:00 - 14:30',
  '15:00 - 15:30',
];

export function ChooseTimeScreen({ navigation }: Props) {
  const [selectedDay, setSelectedDay] = useState('hoje');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const handleSelect = () => {
    if (selectedSlot) navigation.navigate('SearchTrip');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Escolha a hora</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
        {DAY_TABS.map((day) => (
          <TouchableOpacity
            key={day.id}
            style={[styles.dayTab, selectedDay === day.id && styles.dayTabSelected]}
            onPress={() => setSelectedDay(day.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.dayTabText, selectedDay === day.id && styles.dayTabTextSelected]}>
              {day.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.slotsScroll} contentContainerStyle={styles.slotsContent}>
        {TIME_SLOTS.map((slot) => (
          <TouchableOpacity
            key={slot}
            style={styles.slotRow}
            onPress={() => setSelectedSlot(slot)}
            activeOpacity={0.7}
          >
            <Text style={styles.slotText}>{slot}</Text>
            <View style={[styles.radio, selectedSlot === slot && styles.radioSelected]}>
              {selectedSlot === slot && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, !selectedSlot && styles.primaryButtonDisabled]}
          onPress={handleSelect}
          disabled={!selectedSlot}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Selecionar horário</Text>
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
  dayScroll: { marginBottom: 24, maxHeight: 48 },
  dayTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: COLORS.neutral400,
  },
  dayTabSelected: { borderColor: COLORS.black, backgroundColor: COLORS.neutral300 },
  dayTabText: { fontSize: 14, fontWeight: '500', color: COLORS.neutral700 },
  dayTabTextSelected: { color: COLORS.black },
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
  slotText: { fontSize: 16, fontWeight: '500', color: COLORS.black },
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
