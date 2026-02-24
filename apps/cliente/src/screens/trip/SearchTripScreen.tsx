import { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TripStackParamList, 'SearchTrip'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

const RECENT = [
  { address: 'Alameda Ribeirão Preto, 225', city: 'São Paulo - SP' },
  { address: 'Rua Rego Freitas, 370', city: 'São Paulo - SP' },
];

const MOCK_DRIVERS = [
  { id: '1', name: 'Carlos Silva', rating: 4.8, badge: 'Take Me', departure: '14:00', arrival: '16:30', seats: 3, bags: 2 },
  { id: '2', name: 'João Paulo', rating: 3.5, badge: 'Parceiro', departure: '14:05', arrival: '16:35', seats: 2, bags: 1 },
];

const DEFAULT_REGION = {
  latitude: -23.5505,
  longitude: -46.6333,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export function SearchTripScreen({ navigation }: Props) {
  const mapRef = useRef<MapView>(null);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={DEFAULT_REGION}
          showsUserLocation
          showsMyLocationButton={false}
        >
          <Marker coordinate={{ latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude }} />
        </MapView>
      </View>

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Procurando viagem</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.routeCard}>
          <View style={styles.routeDotTop} />
          <View style={styles.routeLine} />
          <View style={styles.routeDotBottom} />
          <View style={styles.routeAddresses}>
            <Text style={styles.routeAddress} numberOfLines={1}>Rua Rego Freitas, 370</Text>
            <Text style={styles.routeAddress} numberOfLines={1}>Alameda Ribeirão Preto, 225</Text>
          </View>
          <TouchableOpacity style={styles.editButton}>
            <MaterialIcons name="edit" size={20} color={COLORS.black} />
          </TouchableOpacity>
        </View>

        <View style={styles.recentSection}>
          {RECENT.map((item, index) => (
            <TouchableOpacity key={index} style={styles.recentRow} activeOpacity={0.7}>
              <MaterialIcons name="access-time" size={20} color={COLORS.neutral700} />
              <Text style={styles.recentText} numberOfLines={1}>{item.address}, {item.city}</Text>
            </TouchableOpacity>
          ))}
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
              <Text style={styles.driverMetaText}>Saída {driver.departure} · Chegada {driver.arrival}</Text>
            </View>
            <View style={styles.driverCapacity}>
              <Text style={styles.capacityText}>{driver.seats} lugares</Text>
              <Text style={styles.capacityText}>{driver.bags} malas</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('ConfirmDetails')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Avançar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Text style={styles.secondaryButtonText}>Agendar para mais tarde</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  mapWrap: { height: 220, width: '100%' },
  map: { width: '100%', height: '100%' },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 48,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backArrow: { fontSize: 22, color: COLORS.black, fontWeight: '600' },
  header: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral300,
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.black },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 32 },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
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
  routeLine: { width: 2, height: 32, backgroundColor: COLORS.neutral400, marginLeft: 5 },
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
  recentSection: { marginBottom: 16, gap: 8 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recentText: { flex: 1, fontSize: 14, color: COLORS.neutral700 },
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
  driverMeta: { marginTop: 4 },
  driverMetaText: { fontSize: 13, color: COLORS.neutral700 },
  driverCapacity: { flexDirection: 'row', gap: 12, marginTop: 8 },
  capacityText: { fontSize: 13, color: COLORS.neutral700 },
  primaryButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.black },
});
