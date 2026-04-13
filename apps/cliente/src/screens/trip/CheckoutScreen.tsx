import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { Text } from '../../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapboxMap,
  MapboxMarker,
  MapboxPolyline,
  isValidTripCoordinate,
  sanitizeMapRegion,
} from '../../components/mapbox';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  TripStackParamList,
  TripDriverParam,
  PaymentConfirmedBookingParam,
  TripLiveDriverDisplay,
} from '../../navigation/types';
import { getRoutePolyline, type RoutePoint } from '../../lib/route';
import { supabase } from '../../lib/supabase';
import { useCurrentLocation } from '../../contexts/CurrentLocationContext';
import { useAppAlert } from '../../contexts/AppAlertContext';
import { getUserErrorMessage } from '../../utils/errorMessage';
import { describeInvokeFailure } from '../../utils/edgeFunctionResponse';
import { formatVehicleDescription, formatDriverRatingLabel } from '../../lib/tripDriverDisplay';
import { fetchResolvedPriceCentsForScheduledTrip } from '../../lib/clientScheduledTrips';
import { MAPBOX_DESTINATION_MARKER_COLOR, MAPBOX_ORIGIN_MARKER_COLOR } from '@take-me/shared';
import { flatPricingSnapshot, applyPromotionToSnapshot } from '../../lib/orderPricingSnapshot';
import { PaymentMethodSection, type PaymentMethodType } from '../../components/PaymentMethodSection';

const supabasePublicUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

function resolveAvatarUri(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl?.trim()) return null;
  return avatarUrl.startsWith('http') ? avatarUrl : `${supabasePublicUrl}/storage/v1/object/public/avatars/${avatarUrl}`;
}

type Props = NativeStackScreenProps<TripStackParamList, 'Checkout'>;

const DEFAULT_DRIVER: TripDriverParam = {
  id: '0',
  driver_id: '',
  name: 'Carlos Silva',
  rating: 4.8,
  badge: 'Take Me',
  departure: '14:00',
  arrival: '16:30',
  seats: 3,
  bags: 3,
  vehicle_model: null,
  vehicle_year: null,
  vehicle_plate: null,
  avatar_url: null,
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

export function CheckoutScreen({ navigation, route }: Props) {
  const { currentPlace } = useCurrentLocation();
  const { showAlert } = useAppAlert();
  const [routeCoords, setRouteCoords] = useState<RoutePoint[] | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType | null>('credito');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  /** Preço alinhado a `scheduled_trips` + `worker_routes` (evita fallback fictício 6400). */
  const [resolvedFareCents, setResolvedFareCents] = useState<number | null>(() =>
    route.params?.scheduled_trip_id ? null : route.params?.driver?.amount_cents ?? null
  );
  const [fareLoading, setFareLoading] = useState(() => Boolean(route.params?.scheduled_trip_id));

  const driver = route.params?.driver ?? DEFAULT_DRIVER;
  const origin = route.params?.origin;
  const destination = route.params?.destination;
  const passengersParam = route.params?.passengers ?? [];
  const bagsCount = route.params?.bags_count ?? driver.bags ?? 0;
  const scheduledTripId = route.params?.scheduled_trip_id;
  const immediateTrip = route.params?.immediateTrip === true;
  const amountCents = resolvedFareCents ?? driver.amount_cents ?? null;
  const fareFormatted =
    amountCents != null
      ? `R$ ${(amountCents / 100).toFixed(2)}`
      : scheduledTripId
        ? 'Carregando preço…'
        : 'R$ —';
  const [tripDateLabel, setTripDateLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!scheduledTripId) {
      setFareLoading(false);
      setResolvedFareCents(driver.amount_cents ?? null);
      return;
    }
    let cancelled = false;
    setFareLoading(true);
    fetchResolvedPriceCentsForScheduledTrip(scheduledTripId).then(({ cents, error }) => {
      if (cancelled) return;
      setFareLoading(false);
      if (error) {
        setResolvedFareCents(driver.amount_cents ?? null);
        return;
      }
      setResolvedFareCents(cents ?? driver.amount_cents ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [scheduledTripId, driver.amount_cents]);

  useEffect(() => {
    if (!scheduledTripId) {
      setTripDateLabel(immediateTrip ? 'Hoje' : null);
      return;
    }
    let cancelled = false;
    supabase
      .from('scheduled_trips')
      .select('departure_at')
      .eq('id', scheduledTripId)
      .single()
      .then(({ data, error }) => {
        if (error || cancelled || !data?.departure_at) {
          if (!cancelled) setTripDateLabel(immediateTrip ? 'Hoje' : null);
          return;
        }
        const d = new Date(data.departure_at);
        setTripDateLabel(d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }));
      });
    return () => { cancelled = true; };
  }, [scheduledTripId, immediateTrip]);

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

  const handleConfirmPayment = useCallback(
    async (params: { method: PaymentMethodType; paymentMethodId?: string }) => {
      if (!origin || !destination) return;
      if (!scheduledTripId) {
        showAlert(
          'Não foi possível concluir',
          'Identificação da viagem em falta. Volte e escolha novamente uma opção de motorista.'
        );
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showAlert('Sessão', 'Faça login para concluir o pagamento.');
        return;
      }
      setPaymentSubmitting(true);
      try {
        const { cents: dbCents, error: priceErr } =
          await fetchResolvedPriceCentsForScheduledTrip(scheduledTripId);
        if (priceErr) {
          showAlert('Preço', priceErr);
          return;
        }
        const finalAmountCents = dbCents ?? driver.amount_cents ?? null;
        if (finalAmountCents == null || finalAmountCents < 0) {
          showAlert(
            'Preço',
            'Não foi possível determinar o valor desta viagem. Verifique se a rota tem preço (worker_routes) ou se a viagem está cadastrada corretamente.'
          );
          return;
        }
        const passenger_data = passengersParam.map((p) => ({
          name: p.name ?? '',
          cpf: p.cpf ?? '',
          bags: p.bags ?? '',
        }));
        const passenger_count = Math.max(1, passengersParam.length);
        // Aplicar promoção ativa (se houver)
        let pricing = flatPricingSnapshot(finalAmountCents);
        let appliedPromoId: string | null = null;
        try {
          const { data: promoResult } = await supabase.rpc('apply_active_promotion', {
            p_order_type: 'bookings',
            p_user_id: user.id,
            p_amount_cents: finalAmountCents,
          });
          if (promoResult && promoResult[0]?.promotion_id) {
            const pr = promoResult[0];
            appliedPromoId = pr.promotion_id;
            pricing = applyPromotionToSnapshot(pricing, pr.promo_discount_cents, pr.adjusted_admin_pct);
          }
        } catch { /* promoção não disponível, segue sem desconto */ }

        let bookingId = '';
        let chargedAmountCents = pricing.amount_cents;

        if (params.method === 'credito' || params.method === 'debito') {
          if (!params.paymentMethodId) {
            showAlert('Pagamento', 'Informe e confirme os dados do cartão.');
            return;
          }
          const { data: { session: sessionBefore } } = await supabase.auth.getSession();
          if (!sessionBefore?.access_token) {
            showAlert('Sessão', 'Faça login novamente para concluir o pagamento.');
            return;
          }
          const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
          const accessToken = refreshData.session?.access_token ?? sessionBefore.access_token;
          if (!accessToken) {
            showAlert(
              'Sessão',
              getUserErrorMessage(refreshErr, 'Sessão expirada. Faça login novamente.'),
            );
            return;
          }
          const { data: ensureData, error: ensureErr } = await supabase.functions.invoke('ensure-stripe-customer', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (ensureErr) {
            const raw = await describeInvokeFailure(ensureData, ensureErr);
            showAlert('Pagamento', getUserErrorMessage({ message: raw }, raw));
            return;
          }
          const { data: chargeData, error: chargeFnError } = await supabase.functions.invoke('charge-booking', {
            headers: { Authorization: `Bearer ${accessToken}` },
            body: {
              stripe_payment_method_id: params.paymentMethodId,
              draft_booking: {
                scheduled_trip_id: scheduledTripId,
                origin_address: origin.address,
                origin_lat: origin.latitude,
                origin_lng: origin.longitude,
                destination_address: destination.address,
                destination_lat: destination.latitude,
                destination_lng: destination.longitude,
                passenger_count,
                bags_count: bagsCount,
                passenger_data,
                promotion_id: appliedPromoId || undefined,
                promo_discount_cents: pricing.promo_discount_cents || 0,
                admin_pct_applied: (pricing as any).admin_pct_applied || undefined,
              },
            },
          });
          if (chargeFnError) {
            const raw = await describeInvokeFailure(chargeData, chargeFnError);
            const chargeErrMsg = getUserErrorMessage({ message: raw }, raw);
            showAlert(
              'Pagamento',
              chargeErrMsg || 'Não foi possível confirmar o pagamento. Nenhuma reserva foi criada.',
            );
            return;
          }
          const chargeBody =
            chargeData && typeof chargeData === 'object' ? (chargeData as Record<string, unknown>) : null;
          bookingId = chargeBody?.booking_id != null ? String(chargeBody.booking_id) : '';
          if (!bookingId) {
            showAlert(
              'Pagamento',
              'Pagamento retornou sem identificador da reserva. Contate o suporte com o horário da tentativa.',
            );
            return;
          }
          const ac = chargeBody?.amount_cents;
          if (typeof ac === 'number' && Number.isFinite(ac) && ac >= 0) {
            chargedAmountCents = Math.floor(ac);
          }
        } else {
          const { data: row, error } = await supabase
            .from('bookings')
            .insert({
              user_id: user.id,
              scheduled_trip_id: scheduledTripId,
              origin_address: origin.address,
              origin_lat: origin.latitude,
              origin_lng: origin.longitude,
              destination_address: destination.address,
              destination_lat: destination.latitude,
              destination_lng: destination.longitude,
              passenger_count,
              bags_count: bagsCount,
              passenger_data,
              ...pricing,
              status: 'pending',
            })
            .select('id')
            .single();
          if (error) {
            showAlert(
              'Erro ao reservar',
              getUserErrorMessage(error, 'Não foi possível registrar sua viagem. Tente novamente.')
            );
            return;
          }
          bookingId = row && typeof row === 'object' && 'id' in row ? String((row as { id: string }).id) : '';
          if (!bookingId) {
            showAlert('Erro', 'Não foi possível obter o identificador da reserva.');
            return;
          }
        }

        const summary: PaymentConfirmedBookingParam = {
          booking_id: bookingId,
          origin_address: origin.address,
          destination_address: destination.address,
          departure: driver.departure,
          arrival: driver.arrival,
          amount_cents: chargedAmountCents,
          driver_name: driver.name,
        };
        const tripLive: TripLiveDriverDisplay = {
          driverName: driver.name,
          rating: driver.rating,
          vehicleLabel: formatVehicleDescription(driver.vehicle_model, driver.vehicle_year, driver.vehicle_plate),
          amountCents: chargedAmountCents,
          bookingId: bookingId || undefined,
          scheduledTripId: scheduledTripId,
          origin: origin
            ? { latitude: origin.latitude, longitude: origin.longitude, address: origin.address }
            : undefined,
          destination: destination
            ? { latitude: destination.latitude, longitude: destination.longitude, address: destination.address }
            : undefined,
        };
        navigation.replace('PaymentConfirmed', {
          booking: summary,
          immediateTrip: route.params?.immediateTrip,
          tripLive,
        });
      } finally {
        setPaymentSubmitting(false);
      }
    },
    [
      bagsCount,
      destination,
      driver.amount_cents,
      driver.arrival,
      driver.departure,
      driver.name,
      driver.rating,
      driver.vehicle_model,
      driver.vehicle_year,
      driver.vehicle_plate,
      navigation,
      origin,
      passengersParam,
      route.params?.immediateTrip,
      scheduledTripId,
      showAlert,
      origin,
      destination,
    ]
  );

  const mapRegion = useMemo(() => {
    const oOk = origin && isValidTripCoordinate(origin.latitude, origin.longitude);
    const dOk = destination && isValidTripCoordinate(destination.latitude, destination.longitude);
    if (oOk && dOk) {
      const latMin = Math.min(origin!.latitude, destination!.latitude);
      const latMax = Math.max(origin!.latitude, destination!.latitude);
      const lngMin = Math.min(origin!.longitude, destination!.longitude);
      const lngMax = Math.max(origin!.longitude, destination!.longitude);
      const padding = 0.004;
      return sanitizeMapRegion({
        latitude: (latMin + latMax) / 2,
        longitude: (lngMin + lngMax) / 2,
        latitudeDelta: Math.max(0.02, latMax - latMin + padding * 2),
        longitudeDelta: Math.max(0.02, lngMax - lngMin + padding * 2),
      });
    }
    if (oOk) {
      return sanitizeMapRegion({
        latitude: origin!.latitude,
        longitude: origin!.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
    if (currentPlace && isValidTripCoordinate(currentPlace.latitude, currentPlace.longitude)) {
      return sanitizeMapRegion({
        latitude: currentPlace.latitude,
        longitude: currentPlace.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
    return sanitizeMapRegion({
      ...DEFAULT_REGION,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  }, [origin, destination, currentPlace]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.mapWrap}>
        <MapboxMap style={styles.map} initialRegion={mapRegion} scrollEnabled={false}>
          {origin && isValidTripCoordinate(origin.latitude, origin.longitude) && (
            <MapboxMarker
              id="origin"
              coordinate={{ latitude: origin.latitude, longitude: origin.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              title="Partida"
              description={origin.address}
              pinColor={MAPBOX_ORIGIN_MARKER_COLOR}
            />
          )}
          {destination && isValidTripCoordinate(destination.latitude, destination.longitude) && (
            <MapboxMarker
              id="destination"
              coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              title="Destino"
              description={destination.address}
              pinColor={MAPBOX_DESTINATION_MARKER_COLOR}
            />
          )}
          {origin &&
            destination &&
            isValidTripCoordinate(origin.latitude, origin.longitude) &&
            isValidTripCoordinate(destination.latitude, destination.longitude) &&
            routeCoords != null &&
            routeCoords.length >= 2 && (
            <MapboxPolyline coordinates={routeCoords} strokeWidth={4} />
          )}
        </MapboxMap>
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
            {resolveAvatarUri(driver.avatar_url) ? (
              <Image source={{ uri: resolveAvatarUri(driver.avatar_url)! }} style={styles.driverAvatarImage} />
            ) : (
              <View style={styles.driverAvatar} />
            )}
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driver.name}</Text>
              <Text style={styles.driverRating}>★ {formatDriverRatingLabel(driver.rating)}</Text>
            </View>
            <Text style={styles.fare}>{fareFormatted}</Text>
          </View>
          <Text style={styles.meta}>
            {tripDateLabel ? `${tripDateLabel} · ` : ''}Saída {driver.departure} · Chegada {driver.arrival}
          </Text>
          <Text style={styles.dynamicPriceNote}>
            O valor final pode variar conforme o horário de solicitação e da partida.
          </Text>
          <View style={styles.metaRow}>
            <MaterialIcons name="directions-car" size={18} color={COLORS.neutral700} />
            <Text style={styles.metaText}>
              {formatVehicleDescription(driver.vehicle_model, driver.vehicle_year, driver.vehicle_plate)}
            </Text>
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
          <PaymentMethodSection
            amountCents={amountCents ?? 0}
            selectedMethod={selectedPaymentMethod}
            onSelectMethod={setSelectedPaymentMethod}
            confirmLabel="Confirmar pagamento"
            cancellationPolicyVariant="trip"
            loading={paymentSubmitting || fareLoading}
            onConfirmPayment={handleConfirmPayment}
          />
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
  driverAvatarImage: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  driverRating: { fontSize: 14, color: COLORS.neutral700 },
  fare: { fontSize: 18, fontWeight: '700', color: COLORS.orange },
  meta: { fontSize: 13, color: COLORS.neutral700, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  metaText: { fontSize: 13, color: COLORS.neutral700 },
  dynamicPriceNote: { fontSize: 12, color: COLORS.neutral700, fontStyle: 'italic', marginTop: 6 },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  passengerText: { flex: 1, fontSize: 14, color: COLORS.black },
  bagsNote: { fontSize: 13, color: COLORS.neutral700, marginTop: 4 },
});
