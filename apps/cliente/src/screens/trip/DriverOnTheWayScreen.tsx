import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { Text } from '../../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapboxMap, sanitizeMapRegion } from '../../components/mapbox';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripFollowStackParamList } from '../../navigation/types';
import { formatDriverRatingLabel } from '../../lib/tripDriverDisplay';
import { loadBookingTripLiveContext, parsePassengerData } from '../../lib/clientBookingTripLive';
import { onlyDigits } from '../../utils/formatCpf';

type Props = NativeStackScreenProps<TripFollowStackParamList, 'DriverOnTheWay'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
  orange: '#EA580C',
};

function formatCpfDisplay(digits: string): string {
  const d = onlyDigits(digits);
  if (d.length !== 11) return digits;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function DriverOnTheWayScreen({ navigation, route }: Props) {
  const live = route.params;
  const driverName = live?.driverName ?? 'Motorista';
  const ratingLabel = formatDriverRatingLabel(live?.rating ?? 0);
  const vehicleLabel = live?.vehicleLabel ?? 'Veículo a confirmar';
  const fareFormatted =
    live?.amountCents != null ? `R$ ${(live.amountCents / 100).toFixed(2).replace('.', ',')}` : 'R$ —';

  const [loading, setLoading] = useState(Boolean(live?.bookingId));
  const [pickupCode, setPickupCode] = useState<string | null>(null);
  const [passengerLines, setPassengerLines] = useState<{ label: string }[]>([]);
  const [bagsCount, setBagsCount] = useState<number | null>(null);

  const mapRegion = useMemo(() => {
    const o = live?.origin;
    const d = live?.destination;
    if (
      o &&
      d &&
      Number.isFinite(o.latitude) &&
      Number.isFinite(o.longitude) &&
      Number.isFinite(d.latitude) &&
      Number.isFinite(d.longitude)
    ) {
      const latMin = Math.min(o.latitude, d.latitude);
      const latMax = Math.max(o.latitude, d.latitude);
      const lngMin = Math.min(o.longitude, d.longitude);
      const lngMax = Math.max(o.longitude, d.longitude);
      const pad = 0.006;
      return sanitizeMapRegion({
        latitude: (latMin + latMax) / 2,
        longitude: (lngMin + lngMax) / 2,
        latitudeDelta: Math.max(0.02, latMax - latMin + pad * 2),
        longitudeDelta: Math.max(0.02, lngMax - lngMin + pad * 2),
      });
    }
    if (o && Number.isFinite(o.latitude) && Number.isFinite(o.longitude)) {
      return sanitizeMapRegion({
        latitude: o.latitude,
        longitude: o.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
    return sanitizeMapRegion({
      latitude: -7.3289,
      longitude: -35.3328,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  }, [live?.origin, live?.destination]);

  const load = useCallback(async () => {
    const bid = live?.bookingId;
    if (!bid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await loadBookingTripLiveContext(bid);
    if (error || !data) {
      setPickupCode(null);
      setPassengerLines([]);
      setBagsCount(null);
      setLoading(false);
      return;
    }
    const { booking, trip } = data;
    setPickupCode(trip?.pickup_code?.trim() || null);
    setBagsCount(booking.bags_count);
    const passengers = parsePassengerData(booking.passenger_data);
    const lines =
      passengers.length > 0
        ? passengers.map((p, i) => {
            const name = (p.name ?? '').trim() || `Passageiro ${i + 1}`;
            const cpf = onlyDigits(p.cpf ?? '');
            const cpfPart = cpf.length >= 11 ? ` · CPF: ${formatCpfDisplay(cpf)}` : '';
            return { label: `${name}${cpfPart}` };
          })
        : [{ label: `${booking.passenger_count} passageiro(es)` }];
    setPassengerLines(lines);
    setLoading(false);
  }, [live?.bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const codeDisplay = pickupCode
    ? `${pickupCode} ✓`
    : loading
      ? '…'
      : '—';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.mapWrap}>
        <MapboxMap style={styles.map} initialRegion={mapRegion} scrollEnabled={false} />
      </View>
      <View style={styles.banner}>
        <MaterialIcons name="check-circle" size={24} color="#FFFFFF" />
        <Text style={styles.bannerText}>Motorista a caminho</Text>
      </View>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Acompanhe sua viagem</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Motorista</Text>
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar} />
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driverName}</Text>
              <Text style={styles.driverRating}>★ {ratingLabel}</Text>
              <Text style={styles.carText}>{vehicleLabel}</Text>
            </View>
            <Text style={styles.fare}>{fareFormatted}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Código de confirmação</Text>
          <View style={styles.codeWrap}>
            <View style={[styles.codeBadge, !pickupCode && styles.codeBadgeMuted]}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.codeText}>{codeDisplay}</Text>
              )}
            </View>
          </View>
          <Text style={styles.codeHint}>
            {pickupCode
              ? 'Informe este código ao motorista para confirmar o embarque.'
              : 'O código aparece aqui quando estiver disponível na viagem. Enquanto isso, use os dados em Atividades ou aguarde o motorista.'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Passageiros</Text>
          {passengerLines.length === 0 ? (
            <Text style={styles.passengerText}>{loading ? 'Carregando…' : 'Dados não informados.'}</Text>
          ) : (
            passengerLines.map((row, i) => (
              <View key={i} style={styles.passengerRow}>
                <MaterialIcons name="person-outline" size={20} color={COLORS.neutral700} />
                <Text style={styles.passengerText}>{row.label}</Text>
              </View>
            ))
          )}
          {bagsCount != null ? (
            <Text style={styles.bagsNote}>
              {bagsCount} {bagsCount === 1 ? 'mala' : 'malas'}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('TripInProgress', live)}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Acompanhar viagem</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  mapWrap: { height: 200, width: '100%' },
  map: { width: '100%', height: '100%' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.black,
    paddingVertical: 14,
    gap: 8,
  },
  bannerText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
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
  sectionTitle: { fontSize: 20, fontWeight: '700', color: COLORS.black, marginBottom: 16, textAlign: 'center' },
  card: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.neutral300,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.black, marginBottom: 12 },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.neutral300, marginRight: 12 },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  driverRating: { fontSize: 14, color: COLORS.neutral700 },
  carText: { fontSize: 13, color: COLORS.neutral700, marginTop: 2 },
  fare: { fontSize: 18, fontWeight: '700', color: COLORS.orange },
  codeWrap: { alignItems: 'center', marginVertical: 12 },
  codeBadge: { backgroundColor: '#22C55E', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, minWidth: 120, alignItems: 'center' },
  codeBadgeMuted: { backgroundColor: COLORS.neutral700 },
  codeText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  codeHint: { fontSize: 13, color: COLORS.neutral700, textAlign: 'center' },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  passengerText: { flex: 1, fontSize: 14, color: COLORS.black },
  bagsNote: { fontSize: 13, color: COLORS.neutral700, marginTop: 4 },
  primaryButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
