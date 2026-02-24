import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TripStackParamList, 'PlanRide'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

const MOCK_DRIVERS = [
  {
    id: '1',
    name: 'Carlos Silva',
    rating: 4.8,
    badge: 'Take Me',
    departure: '14:00',
    arrival: '16:30',
    seats: 3,
    bags: 2,
  },
  {
    id: '2',
    name: 'João Paulo',
    rating: 3.5,
    badge: 'Parceiro',
    departure: '14:05',
    arrival: '16:35',
    seats: 2,
    bags: 1,
  },
];

export function PlanRideScreen({ navigation }: Props) {
  const [origin] = useState('Rua Rego Freitas, 370');
  const [destination] = useState('Alameda Ribeirão Preto, 225');
  const [dateLabel] = useState('3 de outubro de 2025');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Planeje sua corrida</Text>

        <View style={styles.dateRow}>
          <MaterialIcons name="event" size={24} color={COLORS.black} />
          <Text style={styles.dateText}>{dateLabel}</Text>
          <MaterialIcons name="keyboard-arrow-down" size={24} color={COLORS.black} />
        </View>

        <View style={styles.routeCard}>
          <View style={styles.routeDotTop} />
          <View style={styles.routeLine} />
          <View style={styles.routeDotBottom} />
          <View style={styles.routeAddresses}>
            <Text style={styles.routeAddress} numberOfLines={1}>{origin}</Text>
            <Text style={styles.routeAddress} numberOfLines={1}>{destination}</Text>
          </View>
          <TouchableOpacity style={styles.editButton}>
            <MaterialIcons name="edit" size={20} color={COLORS.black} />
          </TouchableOpacity>
        </View>

        {MOCK_DRIVERS.map((driver) => (
          <View key={driver.id} style={styles.driverCard}>
            <View style={styles.driverAvatar} />
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driver.name}</Text>
              <Text style={styles.driverRating}>★ {driver.rating}</Text>
            </View>
            <TouchableOpacity style={styles.badgeButton}>
              <Text style={styles.badgeText}>{driver.badge}</Text>
            </TouchableOpacity>
            <View style={styles.driverMeta}>
              <Text style={styles.driverMetaText}>Saída {driver.departure}</Text>
              <Text style={styles.driverMetaText}>Chegada {driver.arrival}</Text>
            </View>
            <View style={styles.driverCapacity}>
              <Text style={styles.capacityText}>{driver.seats} lugares</Text>
              <Text style={styles.capacityText}>{driver.bags} malas</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.agendarButton}
          onPress={() => navigation.navigate('ChooseTime')}
          activeOpacity={0.8}
        >
          <Text style={styles.agendarButtonText}>Agendar</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 16,
  },
  backArrow: { fontSize: 22, color: COLORS.black, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.black, marginBottom: 20 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  dateText: { flex: 1, fontSize: 16, fontWeight: '500', color: COLORS.black },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  routeDotTop: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.black,
    marginTop: 4,
  },
  routeLine: {
    width: 2,
    flex: 0,
    height: 32,
    backgroundColor: COLORS.neutral400,
    marginLeft: 5,
  },
  routeDotBottom: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.neutral700,
    marginLeft: 5,
    marginTop: 4,
  },
  routeAddresses: { flex: 1, marginLeft: 12, gap: 12 },
  routeAddress: { fontSize: 14, fontWeight: '500', color: COLORS.black },
  editButton: { padding: 4 },
  driverCard: {
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.neutral400,
    marginBottom: 8,
  },
  driverName: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  driverRating: { fontSize: 14, color: COLORS.neutral700, marginTop: 2 },
  driverInfo: { marginBottom: 8 },
  badgeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: COLORS.black },
  driverMeta: { flexDirection: 'row', gap: 16, marginTop: 4 },
  driverMetaText: { fontSize: 13, color: COLORS.neutral700 },
  driverCapacity: { flexDirection: 'row', gap: 12, marginTop: 8 },
  capacityText: { fontSize: 13, color: COLORS.neutral700 },
  agendarButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  agendarButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
