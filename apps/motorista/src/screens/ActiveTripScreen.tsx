import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Animated,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { MapboxMap, MapboxMarker, MapboxPolyline } from '../components/mapbox';
import type { LatLng } from '../components/mapbox';
import { supabase } from '../lib/supabase';
import { Text } from '../components/Text';
import { getRouteWithDuration, getMultiPointRoute, formatEta } from '../lib/route';

// expo-location — defensive import (needs native rebuild if just added)
let Location: any = null;
try { Location = require('expo-location'); } catch { /* not available yet */ }

type Props = NativeStackScreenProps<RootStackParamList, 'ActiveTrip'>;

const GOLD = '#C9A227';
const DARK = '#111827';
const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Stop = {
  id: string;
  type: 'pickup' | 'delivery';
  name: string;
  address: string;
  notes?: string;
  bagSize?: string;
  rating?: number;
  lat?: number;
  lng?: number;
  sourceType: 'booking' | 'shipment';
  sourceId: string;
  /** Código 4 dígitos que o cliente informará ao motorista (somente shipments) */
  code: string | null;
};

type TripRow = {
  id: string;
  origin_address: string;
  destination_address: string;
  departure_at: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  amount_cents: number;
  status: string;
};

type BookingRow = {
  id: string;
  passenger_count: number;
  bags_count: number;
  amount_cents: number;
  profiles: { full_name: string; avatar_url: string | null; rating: number | null } | null;
};

type ShipmentRow = {
  id: string;
  description: string;
  size: string | null;
  notes: string | null;
  origin_address: string;
  destination_address: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  sender_name: string;
  receiver_name: string;
  pickup_code: string | null;
  delivery_code: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function formatDuration(startIso: string, endDate: Date): string {
  const diffMs = endDate.getTime() - new Date(startIso).getTime();
  const totalMin = Math.max(0, Math.floor(diffMs / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function ActiveTripScreen({ navigation, route }: Props) {
  const { tripId } = route.params;

  // Data
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);

  // State machine
  const [currentStopIndex, setCurrentStopIndex] = useState(0);

  // Routes
  const [driverRouteCoords, setDriverRouteCoords] = useState<LatLng[]>([]);
  const [stopsRouteCoords, setStopsRouteCoords] = useState<LatLng[]>([]);
  const [stopsRouteDistanceMeters, setStopsRouteDistanceMeters] = useState<number | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);

  // Driver position
  const [driverPosition, setDriverPosition] = useState<LatLng | null>(null);
  const locationSub = useRef<any>(null);

  // UI state
  const [detailVisible, setDetailVisible] = useState(false);
  const [confirmPickupVisible, setConfirmPickupVisible] = useState(false);
  const [confirmDeliveryVisible, setConfirmDeliveryVisible] = useState(false);
  const [finalizeVisible, setFinalizeVisible] = useState(false);
  const [completedVisible, setCompletedVisible] = useState(false);

  // Confirm modal inputs
  const [confirmCode, setConfirmCode] = useState('');
  const [confirmError, setConfirmError] = useState('');

  // Finalize
  const [expenseAttached, setExpenseAttached] = useState(false);
  const [finalizingTrip, setFinalizingTrip] = useState(false);

  // Rating
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Animations
  const detailSlide = useRef(new Animated.Value(600)).current;
  const finalizeSlide = useRef(new Animated.Value(600)).current;

  // ---------------------------------------------------------------------------
  // Location tracking
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let active = true;
    async function startLocation() {
      if (!Location) return;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (active) {
          setDriverPosition({ latitude: current.coords.latitude, longitude: current.coords.longitude });
        }
        locationSub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 20, timeInterval: 10000 },
          (loc: any) => {
            if (active) {
              setDriverPosition({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            }
          },
        );
      } catch { /* location unavailable */ }
    }
    startLocation();
    return () => {
      active = false;
      locationSub.current?.remove?.();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: tripData }, { data: bookingsData }, { data: shipmentsData }] =
        await Promise.all([
          supabase
            .from('scheduled_trips')
            .select('id, origin_address, destination_address, departure_at, origin_lat, origin_lng, destination_lat, destination_lng, amount_cents, status')
            .eq('id', tripId)
            .single(),
          supabase
            .from('bookings')
            .select('id, passenger_count, bags_count, amount_cents, profiles(full_name, avatar_url, rating)')
            .eq('scheduled_trip_id', tripId)
            .in('status', ['confirmed', 'paid']),
          supabase
            .from('shipments')
            .select('id, description, size, notes, origin_address, destination_address, origin_lat, origin_lng, destination_lat, destination_lng, sender_name, receiver_name, pickup_code, delivery_code')
            .eq('scheduled_trip_id', tripId),
        ]);

      const t = tripData as TripRow | null;
      if (t) setTrip(t);

      const builtStops: Stop[] = [];

      for (const b of (bookingsData ?? []) as BookingRow[]) {
        builtStops.push({
          id: `booking-${b.id}`,
          type: 'pickup',
          name: b.profiles?.full_name ?? 'Passageiro',
          address: t?.origin_address ?? '',
          rating: b.profiles?.rating ?? undefined,
          bagSize: b.bags_count > 0 ? `${b.bags_count} bag(s)` : undefined,
          lat: t?.origin_lat ?? undefined,
          lng: t?.origin_lng ?? undefined,
          sourceType: 'booking',
          sourceId: b.id,
          code: null,
        });
      }

      for (const s of (shipmentsData ?? []) as ShipmentRow[]) {
        builtStops.push({
          id: `shipment-pickup-${s.id}`,
          type: 'pickup',
          name: s.sender_name,
          address: s.origin_address,
          notes: s.notes ?? undefined,
          bagSize: s.size ?? undefined,
          lat: s.origin_lat ?? t?.origin_lat ?? undefined,
          lng: s.origin_lng ?? t?.origin_lng ?? undefined,
          sourceType: 'shipment',
          sourceId: s.id,
          code: s.pickup_code,
        });
        builtStops.push({
          id: `shipment-delivery-${s.id}`,
          type: 'delivery',
          name: s.receiver_name,
          address: s.destination_address,
          notes: s.notes ?? undefined,
          bagSize: s.size ?? undefined,
          lat: s.destination_lat ?? t?.destination_lat ?? undefined,
          lng: s.destination_lng ?? t?.destination_lng ?? undefined,
          sourceType: 'shipment',
          sourceId: s.id,
          code: s.delivery_code,
        });
      }

      setStops(builtStops);
      setStopsRouteDistanceMeters(null);

      // Fetch stops route (full path through all stops)
      if (t?.origin_lat && t?.origin_lng) {
        const waypoints: Array<{ latitude: number; longitude: number }> = [];
        if (t.origin_lat && t.origin_lng) waypoints.push({ latitude: t.origin_lat, longitude: t.origin_lng });
        for (const s of (shipmentsData ?? []) as ShipmentRow[]) {
          if (s.origin_lat && s.origin_lng) waypoints.push({ latitude: s.origin_lat, longitude: s.origin_lng });
          if (s.destination_lat && s.destination_lng) waypoints.push({ latitude: s.destination_lat, longitude: s.destination_lng });
        }
        if (t.destination_lat && t.destination_lng) waypoints.push({ latitude: t.destination_lat, longitude: t.destination_lng });

        if (waypoints.length >= 2) {
          const result = await getMultiPointRoute(waypoints);
          if (result) {
            setStopsRouteCoords(result.coordinates);
            setStopsRouteDistanceMeters(result.distanceMeters);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  // Fetch driver-to-current-stop route when driver position or current stop changes
  useEffect(() => {
    if (!driverPosition || stops.length === 0) return;
    const stop = stops[currentStopIndex];
    if (!stop?.lat || !stop?.lng) return;

    getRouteWithDuration(driverPosition, { latitude: stop.lat, longitude: stop.lng })
      .then((result) => {
        if (result) {
          setDriverRouteCoords(result.coordinates);
          setEtaSeconds(result.durationSeconds);
        }
      })
      .catch(() => {});
  }, [driverPosition, currentStopIndex, stops]);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const currentStop = stops[currentStopIndex] ?? null;
  const totalStops = stops.length;
  const allDone = currentStopIndex >= totalStops && totalStops > 0;

  const mapCenter = {
    latitude: trip?.origin_lat ?? -23.5505,
    longitude: trip?.origin_lng ?? -46.6333,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  };

  // ---------------------------------------------------------------------------
  // Detail sheet animation
  // ---------------------------------------------------------------------------

  const openDetail = () => {
    detailSlide.setValue(600);
    setDetailVisible(true);
    Animated.spring(detailSlide, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  };

  const closeDetail = () => {
    Animated.timing(detailSlide, { toValue: 600, duration: 250, useNativeDriver: true }).start(() =>
      setDetailVisible(false),
    );
  };

  const openFinalize = () => {
    finalizeSlide.setValue(600);
    setFinalizeVisible(true);
    Animated.spring(finalizeSlide, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  };

  const closeFinalize = () => {
    Animated.timing(finalizeSlide, { toValue: 600, duration: 250, useNativeDriver: true }).start(() =>
      setFinalizeVisible(false),
    );
  };

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleConfirmStop = async () => {
    if (!currentStop) return;

    if (currentStop.sourceType === 'shipment') {
      if (confirmCode.trim().length !== 4) {
        setConfirmError('O código deve ter 4 dígitos.');
        return;
      }
      if (currentStop.code && confirmCode.trim() !== currentStop.code) {
        setConfirmError('Código incorreto. Verifique com o cliente.');
        return;
      }
      const now = new Date().toISOString();
      if (currentStop.type === 'pickup') {
        await supabase.from('shipments').update({ picked_up_at: now } as never).eq('id', currentStop.sourceId);
      } else {
        await supabase.from('shipments').update({ delivered_at: now } as never).eq('id', currentStop.sourceId);
      }
    }

    setConfirmError('');
    setConfirmCode('');
    setConfirmPickupVisible(false);
    setConfirmDeliveryVisible(false);
    closeDetail();
    const next = currentStopIndex + 1;
    setCurrentStopIndex(next);
    if (next >= totalStops) openFinalize();
  };

  const handleFinalizeTrip = async () => {
    setFinalizingTrip(true);
    try {
      await supabase.from('scheduled_trips').update({ status: 'completed' } as never).eq('id', tripId);
      closeFinalize();
      setCompletedVisible(true);
    } finally {
      setFinalizingTrip(false);
    }
  };

  const handleSubmitRating = async () => {
    setSubmittingRating(true);
    try {
      if (rating > 0) {
        await supabase.from('trip_ratings' as never).insert({
          trip_id: tripId,
          rating,
          comment: ratingComment.trim() || null,
        } as never);
      }
    } finally {
      setSubmittingRating(false);
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
    }
  };

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DARK} />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* ── Full-screen Mapbox map ───────────────────────────── */}
      <MapboxMap
        style={StyleSheet.absoluteFillObject}
        initialRegion={mapCenter}
        styleURL={MAP_STYLE}
      >
        {/* Route from driver to current stop (dark) */}
        {driverRouteCoords.length >= 2 && (
          <MapboxPolyline id="driver" coordinates={driverRouteCoords} strokeColor={DARK} strokeWidth={3} />
        )}

        {/* Full route between stops (gold) */}
        {stopsRouteCoords.length >= 2 && (
          <MapboxPolyline id="stops" coordinates={stopsRouteCoords} strokeColor={GOLD} strokeWidth={5} />
        )}

        {/* Fallback straight line if no OSRM route yet */}
        {stopsRouteCoords.length < 2 && trip?.origin_lat && trip?.destination_lat && (
          <MapboxPolyline
            id="fallback"
            coordinates={[
              { latitude: trip.origin_lat, longitude: trip.origin_lng! },
              { latitude: trip.destination_lat, longitude: trip.destination_lng! },
            ]}
            strokeColor={GOLD}
            strokeWidth={4}
          />
        )}

        {/* Stop markers */}
        {stops.map((stop, idx) => {
          const lat = stop.lat ?? mapCenter.latitude;
          const lng = stop.lng ?? mapCenter.longitude;
          const isCompleted = idx < currentStopIndex;
          const markerBg = isCompleted ? '#374151' : GOLD;
          return (
            <MapboxMarker
              key={stop.id}
              id={stop.id}
              coordinate={{ latitude: lat + idx * 0.0015, longitude: lng + idx * 0.0008 }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.mapMarker, { backgroundColor: markerBg }]}>
                {isCompleted ? (
                  <MaterialIcons name="check" size={18} color="#fff" />
                ) : stop.sourceType === 'booking' ? (
                  <MaterialIcons name="person" size={18} color="#fff" />
                ) : (
                  <MaterialIcons name="inventory-2" size={18} color="#fff" />
                )}
              </View>
            </MapboxMarker>
          );
        })}

        {/* Driver position marker */}
        {driverPosition && (
          <MapboxMarker
            id="driver"
            coordinate={driverPosition}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.driverPulse}>
              <View style={styles.driverMarker}>
                <MaterialIcons name="play-arrow" size={18} color="#fff" />
              </View>
            </View>
          </MapboxMarker>
        )}
      </MapboxMap>

      {/* ── Overlay UI ──────────────────────────────────────── */}
      <SafeAreaView edges={['top', 'bottom']} style={StyleSheet.absoluteFillObject} pointerEvents="box-none">

        {/* Left sidebar */}
        <View style={styles.sidebar}>
          {stops.map((stop, idx) => {
            const isCompleted = idx < currentStopIndex;
            const isCurrent = idx === currentStopIndex;
            const btnBg = isCompleted ? '#374151' : GOLD;
            const opacity = !isCompleted && !isCurrent ? 0.5 : 1;
            return (
              <TouchableOpacity
                key={stop.id}
                style={[styles.sidebarBtn, { backgroundColor: btnBg, opacity }]}
                onPress={() => { if (idx === currentStopIndex) openDetail(); }}
                activeOpacity={0.8}
              >
                {isCompleted ? (
                  <MaterialIcons name="check" size={20} color="#fff" />
                ) : stop.sourceType === 'booking' ? (
                  <MaterialIcons name="person" size={20} color="#fff" />
                ) : (
                  <MaterialIcons name="inventory-2" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Mini bottom card */}
        {currentStop && !detailVisible && (
          <TouchableOpacity style={styles.miniSheet} onPress={openDetail} activeOpacity={0.95}>
            <View style={styles.handle} />

            <View style={styles.miniSheetTopRow}>
              <View style={styles.stopTypePill}>
                <View style={styles.stopTypeDot} />
                <Text style={styles.stopTypePillText}>
                  {currentStop.type === 'pickup' ? 'Coleta' : 'Entrega'}
                </Text>
              </View>
              {etaSeconds !== null && (
                <View style={styles.etaBadge}>
                  <Text style={styles.etaBadgeText}>{formatEta(etaSeconds)}</Text>
                </View>
              )}
            </View>

            <Text style={styles.miniSheetName}>{currentStop.name}</Text>

            <View style={styles.addressRow}>
              <MaterialIcons name="location-on" size={14} color="#6B7280" />
              <Text style={styles.addressText} numberOfLines={1}>{currentStop.address}</Text>
            </View>

            <View style={styles.progressRow}>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${((currentStopIndex + 1) / Math.max(totalStops, 1)) * 100}%` as any },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{currentStopIndex + 1}/{totalStops}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* All done float button */}
        {allDone && !finalizeVisible && !completedVisible && (
          <TouchableOpacity style={styles.finalizeFloatBtn} onPress={openFinalize} activeOpacity={0.85}>
            <Text style={styles.finalizeFloatBtnText}>Finalizar viagem</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* ── Detail bottom sheet ─────────────────────────────── */}
      <Modal visible={detailVisible} transparent animationType="none" onRequestClose={closeDetail}>
        <Pressable style={styles.overlay} onPress={closeDetail} />
        <Animated.View style={[styles.detailSheet, { transform: [{ translateY: detailSlide }] }]}>
          <View style={styles.handle} />

          <View style={styles.detailTopRow}>
            <TouchableOpacity style={styles.iconCircleBtn} onPress={closeDetail} activeOpacity={0.7}>
              <MaterialIcons name="close" size={20} color={DARK} />
            </TouchableOpacity>
            <Text style={styles.detailTitle}>
              {currentStop?.type === 'pickup' ? 'Detalhes da coleta' : `Entrega para ${currentStop?.name ?? ''}`}
            </Text>
            <TouchableOpacity style={styles.iconCircleBtn} activeOpacity={0.7}>
              <MaterialIcons name="phone" size={20} color={DARK} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScroll}>
            {currentStop?.type === 'pickup' ? (
              <>
                <View style={styles.avatarCenter}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitials}>{getInitials(currentStop?.name ?? '?')}</Text>
                  </View>
                </View>
                <Text style={styles.detailName}>{currentStop?.name}</Text>
                <View style={styles.detailMetaRow}>
                  {currentStop?.rating !== undefined && (
                    <>
                      <MaterialIcons name="star" size={14} color={GOLD} />
                      <Text style={styles.detailMetaText}>{currentStop.rating.toFixed(1)}</Text>
                    </>
                  )}
                  {currentStop?.bagSize && (
                    <Text style={styles.detailMetaText}> · {currentStop.bagSize}</Text>
                  )}
                </View>
                <Text style={styles.detailLabel}>Endereço da coleta</Text>
                <Text style={styles.detailValue}>{currentStop?.address}</Text>
                {currentStop?.notes ? (
                  <>
                    <Text style={styles.detailLabel}>Observações</Text>
                    <Text style={styles.detailValue}>{currentStop.notes}</Text>
                  </>
                ) : null}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => { setConfirmCode(''); setConfirmError(''); setConfirmPickupVisible(true); }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.actionBtnText}>Iniciar coleta</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>Cancelar coleta</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.avatarCenter}>
                  <View style={[styles.avatarCircle, { backgroundColor: GOLD }]}>
                    <MaterialIcons name="inventory-2" size={26} color="#fff" />
                  </View>
                </View>
                <View style={styles.deliveryArrowRow}>
                  <Text style={styles.deliveryNameText}>
                    {'Destinatário: '}
                    <Text style={{ fontWeight: '700' }}>{currentStop?.name}</Text>
                  </Text>
                </View>
                <Text style={styles.detailLabel}>Local de entrega</Text>
                <Text style={styles.detailValue}>{currentStop?.address}</Text>
                {currentStop?.notes ? (
                  <>
                    <Text style={styles.detailLabel}>Observações</Text>
                    <Text style={styles.detailValue}>{currentStop.notes}</Text>
                  </>
                ) : null}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => { setConfirmCode(''); setConfirmError(''); setConfirmDeliveryVisible(true); }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.actionBtnText}>Confirmar entrega</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </Animated.View>
      </Modal>

      {/* ── Confirm Pickup ──────────────────────────────────── */}
      <Modal
        visible={confirmPickupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmPickupVisible(false)}
      >
        <View style={styles.centeredModalOverlay}>
          <View style={styles.centeredModal}>
            <Text style={styles.centeredModalTitle}>Confirmar coleta</Text>
            <Text style={styles.centeredModalSubtitle}>
              {currentStop?.sourceType === 'shipment'
                ? 'Insira o código de 4 dígitos informado pelo remetente.'
                : 'Confirme a coleta do passageiro.'}
            </Text>
            {currentStop?.sourceType === 'shipment' && (
              <>
                <Text style={styles.fieldLabel}>Código de coleta</Text>
                <TextInput
                  style={styles.codeInput}
                  value={confirmCode}
                  onChangeText={(v) => { setConfirmCode(v.replace(/\D/g, '').slice(0, 4)); setConfirmError(''); }}
                  keyboardType="numeric"
                  maxLength={4}
                  placeholder="0000"
                  placeholderTextColor="#9CA3AF"
                  textAlign="center"
                />
              </>
            )}
            {confirmError ? <Text style={styles.errorText}>{confirmError}</Text> : null}
            <TouchableOpacity style={styles.actionBtn} onPress={handleConfirmStop} activeOpacity={0.85}>
              <Text style={styles.actionBtnText}>Confirmar coleta</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setConfirmCode(''); setConfirmError(''); setConfirmPickupVisible(false); }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Confirm Delivery ────────────────────────────────── */}
      <Modal
        visible={confirmDeliveryVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDeliveryVisible(false)}
      >
        <View style={styles.centeredModalOverlay}>
          <View style={styles.centeredModal}>
            <Text style={styles.centeredModalTitle}>Confirmar entrega</Text>
            <Text style={styles.centeredModalSubtitle}>
              {currentStop?.sourceType === 'shipment'
                ? 'Insira o código informado pelo cliente para confirmar a entrega.'
                : 'Confirme a entrega para continuar.'}
            </Text>
            {currentStop?.sourceType === 'shipment' && (
              <>
                <Text style={styles.fieldLabel}>Código de entrega</Text>
                <TextInput
                  style={styles.codeInput}
                  value={confirmCode}
                  onChangeText={(v) => { setConfirmCode(v.replace(/\D/g, '').slice(0, 4)); setConfirmError(''); }}
                  keyboardType="numeric"
                  maxLength={4}
                  placeholder="0000"
                  placeholderTextColor="#9CA3AF"
                  textAlign="center"
                />
              </>
            )}
            {confirmError ? <Text style={styles.errorText}>{confirmError}</Text> : null}
            <TouchableOpacity style={styles.actionBtn} onPress={handleConfirmStop} activeOpacity={0.85}>
              <Text style={styles.actionBtnText}>Confirmar entrega</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setConfirmCode(''); setConfirmError(''); setConfirmDeliveryVisible(false); }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Finalize Trip sheet ─────────────────────────────── */}
      <Modal visible={finalizeVisible} transparent animationType="none" onRequestClose={closeFinalize}>
        <Pressable style={styles.overlay} onPress={closeFinalize} />
        <Animated.View style={[styles.detailSheet, { transform: [{ translateY: finalizeSlide }] }]}>
          <View style={styles.handle} />
          <Text style={styles.detailTitle}>Finalizar viagem</Text>

          <View style={styles.finalizeSummaryCard}>
            <View style={styles.finalizeSummaryRow}>
              <Text style={styles.finalizeSummaryLabel}>Tempo total</Text>
              <Text style={styles.finalizeSummaryValue}>
                {trip?.departure_at ? formatDuration(trip.departure_at, new Date()) : '—'}
              </Text>
            </View>
            <View style={styles.finalizeDivider} />
            <View style={styles.finalizeSummaryRow}>
              <Text style={styles.finalizeSummaryLabel}>Distância</Text>
              <Text style={styles.finalizeSummaryValue}>
                {stopsRouteDistanceMeters !== null ? `${(stopsRouteDistanceMeters / 1000).toFixed(1)} km` : '—'}
              </Text>
            </View>
            <View style={styles.finalizeDivider} />
            <View style={styles.finalizeSummaryRow}>
              <Text style={styles.finalizeSummaryLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusBadgeText}>Concluído</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.expenseBox, expenseAttached && styles.expenseBoxAttached]}
            onPress={() => setExpenseAttached(!expenseAttached)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="description" size={24} color={expenseAttached ? GOLD : '#9CA3AF'} />
            <Text style={[styles.expenseText, expenseAttached && { color: GOLD }]}>
              {expenseAttached ? 'Despesa anexada' : 'Clique para anexar'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.expenseOptional}>Anexar despesas (opcional)</Text>

          <TouchableOpacity
            style={[styles.actionBtn, finalizingTrip && { opacity: 0.6 }]}
            onPress={handleFinalizeTrip}
            disabled={finalizingTrip}
            activeOpacity={0.85}
          >
            {finalizingTrip ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>Enviar e finalizar viagem</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </Modal>

      {/* ── Trip Completed overlay ──────────────────────────── */}
      <Modal visible={completedVisible} transparent={false} animationType="fade" onRequestClose={() => {}}>
        <SafeAreaView style={styles.completedContainer} edges={[]}>
          <StatusBar style="dark" />
          <ScrollView contentContainerStyle={styles.completedScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.completedIconCircle}>
              <MaterialIcons name="check" size={40} color="#fff" />
            </View>
            <Text style={styles.completedTitle}>Viagem Concluída!</Text>
            <Text style={styles.completedSubtitle}>Todas as entregas foram realizadas com sucesso</Text>

            <View style={styles.completedStatsRow}>
              <View style={styles.completedStatItem}>
                <Text style={styles.completedStatValue}>
                  {trip?.departure_at ? formatDuration(trip.departure_at, new Date()) : '—'}
                </Text>
                <Text style={styles.completedStatLabel}>Tempo total</Text>
              </View>
              <View style={styles.completedStatDivider} />
              <View style={styles.completedStatItem}>
                <Text style={styles.completedStatValue}>{totalStops}</Text>
                <Text style={styles.completedStatLabel}>Paradas</Text>
              </View>
              <View style={styles.completedStatDivider} />
              <View style={styles.completedStatItem}>
                <Text style={styles.completedStatValue}>
                  {trip?.amount_cents
                    ? `R$ ${(trip.amount_cents / 100).toFixed(2).replace('.', ',')}`
                    : '—'}
                </Text>
                <Text style={styles.completedStatLabel}>Total recebido</Text>
              </View>
            </View>

            <Text style={styles.ratingQuestion}>Como foi a viagem?</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                  <MaterialIcons
                    name={star <= rating ? 'star' : 'star-border'}
                    size={36}
                    color={star <= rating ? GOLD : '#D1D5DB'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingHint}>(1 = muito insatisfeito, 5 = muito satisfeito)</Text>

            <Text style={styles.fieldLabel}>Comentário</Text>
            <TextInput
              style={styles.commentInput}
              value={ratingComment}
              onChangeText={setRatingComment}
              placeholder="Opcional"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.actionBtn, submittingRating && { opacity: 0.6 }]}
              onPress={handleSubmitRating}
              disabled={submittingRating}
              activeOpacity={0.85}
            >
              {submittingRating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>Enviar avaliação</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },

  // ── Map markers ──────────────────────────────────────────
  mapMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },

  // Driver marker
  driverPulse: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(17,24,39,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: DARK,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },

  // ── Left sidebar ─────────────────────────────────────────
  sidebar: {
    position: 'absolute',
    left: 14,
    top: 100,
    gap: 8,
  },
  sidebarBtn: {
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },

  // ── Mini bottom sheet ─────────────────────────────────────
  miniSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 14,
  },
  miniSheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stopTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FEF9C3',
    borderRadius: 20,
  },
  stopTypeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: GOLD,
  },
  stopTypePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  etaBadge: {
    backgroundColor: DARK,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  etaBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  miniSheetName: {
    fontSize: 22,
    fontWeight: '700',
    color: DARK,
    marginBottom: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 0,
  },
  addressText: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    minWidth: 28,
    textAlign: 'right',
  },

  // ── Finalize float button ────────────────────────────────
  finalizeFloatBtn: {
    position: 'absolute',
    bottom: 36,
    left: 24,
    right: 24,
    backgroundColor: DARK,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  finalizeFloatBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Overlay ───────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  // ── Detail / Finalize sheet ───────────────────────────────
  detailSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 32,
    maxHeight: '90%',
  },
  detailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK,
    flex: 1,
    textAlign: 'center',
  },
  iconCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScroll: { paddingBottom: 16 },
  avatarCenter: { alignItems: 'center', marginBottom: 12 },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: '#fff', fontSize: 20, fontWeight: '700' },
  detailName: { fontSize: 20, fontWeight: '700', color: DARK, textAlign: 'center', marginBottom: 6 },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 20,
  },
  detailMetaText: { fontSize: 14, color: '#6B7280' },
  detailLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 14, marginBottom: 4, fontWeight: '600' },
  detailValue: { fontSize: 15, color: DARK, fontWeight: '500' },
  deliveryArrowRow: { alignItems: 'center', marginBottom: 16 },
  deliveryNameText: { fontSize: 15, color: '#6B7280', textAlign: 'center' },
  actionBtn: {
    backgroundColor: DARK,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelBtnText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },

  // ── Centered modal ────────────────────────────────────────
  centeredModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  centeredModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  centeredModalTitle: { fontSize: 18, fontWeight: '700', color: DARK, marginBottom: 8 },
  centeredModalSubtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 4 },
  codeInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: '700',
    color: DARK,
    letterSpacing: 8,
    backgroundColor: '#F9FAFB',
    marginBottom: 4,
  },
  errorText: { fontSize: 13, color: '#EF4444', marginTop: 4, marginBottom: 4, textAlign: 'center' },

  // ── Finalize summary card ─────────────────────────────────
  finalizeSummaryCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    marginTop: 12,
  },
  finalizeSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  finalizeSummaryLabel: { fontSize: 14, color: '#6B7280' },
  finalizeSummaryValue: { fontSize: 15, fontWeight: '700', color: DARK },
  finalizeDivider: { height: 1, backgroundColor: '#F3F4F6' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  statusBadgeText: { fontSize: 14, fontWeight: '600', color: '#166534' },
  expenseBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
  },
  expenseBoxAttached: { borderColor: GOLD },
  expenseText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
  expenseOptional: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 20 },

  // ── Completed screen ─────────────────────────────────────
  completedContainer: { flex: 1, backgroundColor: '#fff' },
  completedScroll: { paddingHorizontal: 24, paddingBottom: 48, paddingTop: 40, alignItems: 'center' },
  completedIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  completedTitle: { fontSize: 26, fontWeight: '700', color: DARK, marginBottom: 8, textAlign: 'center' },
  completedSubtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  completedStatsRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 28,
    width: '100%',
  },
  completedStatItem: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  completedStatValue: { fontSize: 16, fontWeight: '700', color: DARK, marginBottom: 4 },
  completedStatLabel: { fontSize: 11, color: '#9CA3AF', textAlign: 'center' },
  completedStatDivider: { width: 1, backgroundColor: '#E5E7EB' },
  ratingQuestion: { fontSize: 17, fontWeight: '700', color: DARK, marginBottom: 12, textAlign: 'center' },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  ratingHint: { fontSize: 12, color: '#9CA3AF', marginBottom: 20, textAlign: 'center' },
  commentInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: DARK,
    minHeight: 100,
    backgroundColor: '#F9FAFB',
    marginBottom: 20,
  },
});
