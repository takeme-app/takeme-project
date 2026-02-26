import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripStackParamList, TripDriverParam, PaymentConfirmedBookingParam } from '../../navigation/types';
import { getRoutePolyline, type RoutePoint } from '../../lib/route';
import { supabase } from '../../lib/supabase';

type Props = NativeStackScreenProps<TripStackParamList, 'Checkout'>;

const DEFAULT_DRIVER: TripDriverParam = {
  id: '0',
  name: 'Carlos Silva',
  rating: 4.8,
  badge: 'Take Me',
  departure: '14:00',
  arrival: '16:30',
  seats: 3,
  bags: 3,
};

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
  orange: '#EA580C',
};

const DEFAULT_REGION = {
  latitude: -7.3289,
  longitude: -35.3328,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

type SavedPaymentMethod = { id: string; type: string; last_four: string | null; holder_name: string | null; brand: string | null };

export function CheckoutScreen({ navigation, route }: Props) {
  const [routeCoords, setRouteCoords] = useState<RoutePoint[] | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);

  const driver = route.params?.driver ?? DEFAULT_DRIVER;
  const origin = route.params?.origin;
  const destination = route.params?.destination;
  const passengersParam = route.params?.passengers ?? [];
  const bagsCount = route.params?.bags_count ?? driver.bags ?? 0;
  const scheduledTripId = route.params?.scheduled_trip_id;
  const amountCents = driver.amount_cents ?? 6400;
  const fareFormatted = `R$ ${(amountCents / 100).toFixed(2)}`;

  const loadPaymentMethods = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMethodsLoading(false);
      return;
    }
    const { data } = await supabase
      .from('payment_methods')
      .select('id, type, last_four, holder_name, brand')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setPaymentMethods((data ?? []) as SavedPaymentMethod[]);
    setSelectedPaymentMethodId((prev) => (prev && data?.some((m) => m.id === prev)) ? prev : (data?.[0]?.id ?? null));
    setMethodsLoading(false);
  }, []);

  useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

  useEffect(() => {
    if (!origin || !destination) {
      setRouteCoords(null);
      return;
    }
    let cancelled = false;
    getRoutePolyline(origin, destination).then((coords) => {
      if (!cancelled) setRouteCoords(coords?.length ? coords : null);
    });
    return () => { cancelled = true; };
  }, [origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude]);

  const mapRegion = useMemo(() => {
    if (origin && destination) {
      const latMin = Math.min(origin.latitude, destination.latitude);
      const latMax = Math.max(origin.latitude, destination.latitude);
      const lngMin = Math.min(origin.longitude, destination.longitude);
      const lngMax = Math.max(origin.longitude, destination.longitude);
      const padding = 0.004;
      return {
        latitude: (latMin + latMax) / 2,
        longitude: (lngMin + lngMax) / 2,
        latitudeDelta: Math.max(0.02, latMax - latMin + padding * 2),
        longitudeDelta: Math.max(0.02, lngMax - lngMin + padding * 2),
      };
    }
    if (origin) {
      return {
        latitude: origin.latitude,
        longitude: origin.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    return DEFAULT_REGION;
  }, [origin, destination]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.mapWrap}>
        <MapView style={styles.map} initialRegion={mapRegion} scrollEnabled={false}>
          {origin && (
            <Marker
              coordinate={{ latitude: origin.latitude, longitude: origin.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              title="Partida"
              description={origin.address}
              pinColor="#0d0d0d"
              tracksViewChanges={false}
            />
          )}
          {destination && (
            <Marker
              coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              title="Destino"
              description={destination.address}
              pinColor="#dc2626"
              tracksViewChanges={false}
            />
          )}
          {origin && destination && (
            <Polyline
              coordinates={
                routeCoords?.length
                  ? routeCoords
                  : [
                      { latitude: origin.latitude, longitude: origin.longitude },
                      { latitude: destination.latitude, longitude: destination.longitude },
                    ]
              }
              strokeColor={COLORS.black}
              strokeWidth={4}
            />
          )}
        </MapView>
      </View>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Checkout</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Motorista</Text>
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar} />
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driver.name}</Text>
              <Text style={styles.driverRating}>★ {driver.rating}</Text>
            </View>
            <Text style={styles.fare}>{fareFormatted}</Text>
          </View>
          <Text style={styles.meta}>Saída {driver.departure} · Chegada {driver.arrival}</Text>
          <View style={styles.metaRow}>
            <MaterialIcons name="directions-car" size={18} color={COLORS.neutral700} />
            <Text style={styles.metaText}>Argo Sedan • Placa RIO 2877</Text>
          </View>
          <View style={styles.metaRow}>
            <MaterialIcons name="work-outline" size={18} color={COLORS.neutral700} />
            <Text style={styles.metaText}>{bagsCount} malas</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Passageiros</Text>
          {passengersParam.length > 0 ? (
            <>
              {passengersParam.map((p, i) => (
                <View key={i} style={styles.passengerRow}>
                  <MaterialIcons name="person-outline" size={20} color={COLORS.neutral700} />
                  <Text style={styles.passengerText}>
                    {p.name || `Passageiro ${i + 1}`}{p.cpf ? ` · CPF: ${p.cpf}` : ''}
                  </Text>
                </View>
              ))}
              <Text style={styles.bagsNote}>{bagsCount} malas adicionadas</Text>
            </>
          ) : (
            <>
              <View style={styles.passengerRow}>
                <MaterialIcons name="person-outline" size={20} color={COLORS.neutral700} />
                <Text style={styles.passengerText}>Passageiros não informados</Text>
              </View>
              <Text style={styles.bagsNote}>{bagsCount} malas</Text>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Método de pagamento</Text>
          {methodsLoading ? (
            <View style={styles.paymentLoading}>
              <ActivityIndicator size="small" color={COLORS.black} />
              <Text style={styles.paymentLoadingText}>Carregando...</Text>
            </View>
          ) : paymentMethods.length === 0 ? (
            <Text style={styles.paymentEmpty}>Adicione um cartão na Carteira para pagar.</Text>
          ) : (
            paymentMethods.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.paymentRow}
                onPress={() => setSelectedPaymentMethodId(m.id)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="credit-card" size={22} color={COLORS.black} />
                <Text style={styles.paymentLabel}>
                  {m.type === 'credit' ? 'Crédito' : 'Débito'}
                  {m.last_four ? ` •••• ${m.last_four}` : ''}
                  {m.holder_name ? ` · ${m.holder_name}` : ''}
                </Text>
                <View style={[styles.radio, selectedPaymentMethodId === m.id && styles.radioSelected]}>
                  {selectedPaymentMethodId === m.id && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <TouchableOpacity
          style={[styles.confirmButton, (!origin || !destination) && styles.primaryButtonDisabled]}
          onPress={() => {
            if (!origin || !destination) return;
            const summary: PaymentConfirmedBookingParam = {
              booking_id: 'pending',
              origin_address: origin.address,
              destination_address: destination.address,
              departure: driver.departure,
              arrival: driver.arrival,
              amount_cents: amountCents,
              driver_name: driver.name,
            };
            navigation.replace('PaymentConfirmed', { booking: summary, immediateTrip: route.params?.immediateTrip });
          }}
          disabled={!origin || !destination}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmButtonText}>Confirmar pagamento</Text>
        </TouchableOpacity>
        <View style={styles.policy}>
          <Text style={styles.policyText}>Cancelamento até 12h antes: reembolso integral</Text>
          <Text style={styles.policyText}>Reagendamento permitido até 2h antes</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  mapWrap: { height: 180, width: '100%' },
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
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 32 },
  screenTitle: { fontSize: 22, fontWeight: '700', color: COLORS.black, marginBottom: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.neutral300,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.black, marginBottom: 12 },
  driverRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.neutral300, marginRight: 12 },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  driverRating: { fontSize: 14, color: COLORS.neutral700 },
  fare: { fontSize: 18, fontWeight: '700', color: COLORS.orange },
  meta: { fontSize: 13, color: COLORS.neutral700, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  metaText: { fontSize: 13, color: COLORS.neutral700 },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  passengerText: { flex: 1, fontSize: 14, color: COLORS.black },
  bagsNote: { fontSize: 13, color: COLORS.neutral700, marginTop: 4 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  paymentLabel: { flex: 1, fontSize: 16, fontWeight: '500', color: COLORS.black },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.neutral400, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: COLORS.black },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.black },
  paymentLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  paymentLoadingText: { fontSize: 14, color: COLORS.neutral700 },
  paymentEmpty: { fontSize: 14, color: COLORS.neutral700, paddingVertical: 8 },
  confirmButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  confirmButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  primaryButtonDisabled: { opacity: 0.5 },
  policy: { gap: 4 },
  policyText: { fontSize: 13, color: COLORS.neutral700 },
});
