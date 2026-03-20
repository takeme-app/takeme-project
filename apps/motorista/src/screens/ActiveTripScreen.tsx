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

type Props = NativeStackScreenProps<RootStackParamList, 'ActiveTrip'>;

const GOLD = '#C9A227';
const DARK = '#111827';

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
  sender_name: string;
  receiver_name: string;
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
  // Load data
  // ---------------------------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: tripData }, { data: bookingsData }, { data: shipmentsData }] =
        await Promise.all([
          supabase
            .from('scheduled_trips')
            .select(
              'id, origin_address, destination_address, departure_at, origin_lat, origin_lng, destination_lat, destination_lng, amount_cents, status'
            )
            .eq('id', tripId)
            .single(),
          supabase
            .from('bookings')
            .select('id, passenger_count, bags_count, amount_cents, profiles(full_name, avatar_url, rating)')
            .eq('scheduled_trip_id', tripId)
            .in('status', ['confirmed', 'paid']),
          supabase
            .from('shipments')
            .select('id, description, size, notes, origin_address, destination_address, sender_name, receiver_name')
            .eq('scheduled_trip_id', tripId),
        ]);

      if (tripData) setTrip(tripData as TripRow);

      const builtStops: Stop[] = [];

      // Bookings → one pickup stop each
      for (const b of (bookingsData ?? []) as BookingRow[]) {
        builtStops.push({
          id: `booking-${b.id}`,
          type: 'pickup',
          name: b.profiles?.full_name ?? 'Passageiro',
          address: (tripData as TripRow | null)?.origin_address ?? '',
          rating: b.profiles?.rating ?? undefined,
          bagSize: b.bags_count > 0 ? `${b.bags_count} bag(s)` : undefined,
          lat: (tripData as TripRow | null)?.origin_lat ?? undefined,
          lng: (tripData as TripRow | null)?.origin_lng ?? undefined,
          sourceType: 'booking',
          sourceId: b.id,
        });
      }

      // Shipments → pickup + delivery
      for (const s of (shipmentsData ?? []) as ShipmentRow[]) {
        builtStops.push({
          id: `shipment-pickup-${s.id}`,
          type: 'pickup',
          name: s.sender_name,
          address: s.origin_address,
          notes: s.notes ?? undefined,
          bagSize: s.size ?? undefined,
          lat: (tripData as TripRow | null)?.origin_lat ?? undefined,
          lng: (tripData as TripRow | null)?.origin_lng ?? undefined,
          sourceType: 'shipment',
          sourceId: s.id,
        });
        builtStops.push({
          id: `shipment-delivery-${s.id}`,
          type: 'delivery',
          name: s.receiver_name,
          address: s.destination_address,
          notes: s.notes ?? undefined,
          bagSize: s.size ?? undefined,
          lat: (tripData as TripRow | null)?.destination_lat ?? undefined,
          lng: (tripData as TripRow | null)?.destination_lng ?? undefined,
          sourceType: 'shipment',
          sourceId: s.id,
        });
      }

      setStops(builtStops);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const currentStop = stops[currentStopIndex] ?? null;
  const totalStops = stops.length;
  const allDone = currentStopIndex >= totalStops && totalStops > 0;

  const mapRegion = {
    latitude: trip?.origin_lat ?? -23.5505,
    longitude: trip?.origin_lng ?? -46.6333,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const polylineCoords: LatLng[] = [];
  if (trip?.origin_lat && trip?.origin_lng) {
    polylineCoords.push({ latitude: trip.origin_lat, longitude: trip.origin_lng });
  }
  if (trip?.destination_lat && trip?.destination_lng) {
    polylineCoords.push({ latitude: trip.destination_lat, longitude: trip.destination_lng });
  }

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
      setDetailVisible(false)
    );
  };

  const openFinalize = () => {
    finalizeSlide.setValue(600);
    setFinalizeVisible(true);
    Animated.spring(finalizeSlide, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  };

  const closeFinalize = () => {
    Animated.timing(finalizeSlide, { toValue: 600, duration: 250, useNativeDriver: true }).start(() =>
      setFinalizeVisible(false)
    );
  };

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleConfirmStop = () => {
    if (confirmCode.trim().length !== 4) {
      setConfirmError('O código deve ter 4 dígitos.');
      return;
    }
    setConfirmError('');
    setConfirmCode('');
    setConfirmPickupVisible(false);
    setConfirmDeliveryVisible(false);
    closeDetail();
    const next = currentStopIndex + 1;
    setCurrentStopIndex(next);
    if (next >= totalStops) {
      openFinalize();
    }
  };

  const handleFinalizeTrip = async () => {
    setFinalizingTrip(true);
    try {
      await supabase
        .from('scheduled_trips')
        .update({ status: 'completed' } as never)
        .eq('id', tripId);
      closeFinalize();
      setCompletedVisible(true);
    } finally {
      setFinalizingTrip(false);
    }
  };

  const handleSubmitRating = async () => {
    setSubmittingRating(true);
    try {
      // Optionally store rating — fire and forget
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
  // Loading / empty
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

      {/* Full-screen map */}
      <MapboxMap style={StyleSheet.absoluteFillObject} initialRegion={mapRegion}>
        {polylineCoords.length >= 2 && (
          <MapboxPolyline coordinates={polylineCoords} strokeColor={GOLD} strokeWidth={4} />
        )}

        {stops.map((stop, idx) => {
          const lat = stop.lat ?? mapRegion.latitude;
          const lng = stop.lng ?? mapRegion.longitude;
          const isCompleted = idx < currentStopIndex;
          const isCurrent = idx === currentStopIndex;
          const markerBg = isCompleted ? DARK : GOLD;

          return (
            <MapboxMarker
              key={stop.id}
              id={stop.id}
              coordinate={{ latitude: lat + idx * 0.001, longitude: lng + idx * 0.0005 }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.mapMarker, { backgroundColor: markerBg }]}>
                {isCompleted ? (
                  <MaterialIcons name="check" size={16} color="#fff" />
                ) : isCurrent ? (
                  <MaterialIcons name="play-arrow" size={16} color="#fff" />
                ) : stop.sourceType === 'booking' ? (
                  <MaterialIcons name="person" size={16} color="#fff" />
                ) : (
                  <MaterialIcons name="inbox" size={16} color="#fff" />
                )}
              </View>
            </MapboxMarker>
          );
        })}
      </MapboxMap>

      {/* Safe area wrapper so back button doesn't clip */}
      <SafeAreaView edges={[]} style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        {/* Left sidebar */}
        <View style={styles.sidebar}>
          {stops.map((stop, idx) => {
            const isCompleted = idx < currentStopIndex;
            const isCurrent = idx === currentStopIndex;
            const btnBg = isCompleted ? DARK : GOLD;
            const opacity = !isCompleted && !isCurrent ? 0.6 : 1;

            return (
              <TouchableOpacity
                key={stop.id}
                style={[styles.sidebarBtn, { backgroundColor: btnBg, opacity }]}
                onPress={() => {
                  if (idx === currentStopIndex) openDetail();
                }}
                activeOpacity={0.8}
              >
                {isCompleted ? (
                  <MaterialIcons name="check" size={20} color="#fff" />
                ) : stop.sourceType === 'booking' ? (
                  <MaterialIcons name="person" size={20} color="#fff" />
                ) : (
                  <MaterialIcons name="inbox" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Mini bottom sheet */}
        {currentStop && !detailVisible && (
          <TouchableOpacity style={styles.miniSheet} onPress={openDetail} activeOpacity={0.95}>
            <View style={styles.handle} />

            <View style={styles.miniSheetTopRow}>
              {/* Stop type pill */}
              <View style={styles.stopTypePill}>
                <View style={styles.stopTypeDot} />
                <Text style={styles.stopTypePillText}>
                  {currentStop.type === 'pickup' ? 'Coleta' : 'Entrega'}
                </Text>
              </View>

              {/* ETA badge */}
              <View style={styles.etaBadge}>
                <Text style={styles.etaBadgeText}>~12 min</Text>
              </View>
            </View>

            <Text style={styles.miniSheetName}>{currentStop.name}</Text>

            <View style={styles.addressRow}>
              <MaterialIcons name="location-on" size={14} color="#6B7280" />
              <Text style={styles.addressText} numberOfLines={1}>
                {currentStop.address}
              </Text>
            </View>

            {/* Progress bar */}
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${((currentStopIndex + 1) / totalStops) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {currentStopIndex + 1}/{totalStops}
            </Text>
          </TouchableOpacity>
        )}

        {/* All done floating button */}
        {allDone && !finalizeVisible && !completedVisible && (
          <TouchableOpacity style={styles.finalizeFloatBtn} onPress={openFinalize} activeOpacity={0.85}>
            <Text style={styles.finalizeFloatBtnText}>Finalizar viagem</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* Detail bottom sheet modal */}
      <Modal visible={detailVisible} transparent animationType="none" onRequestClose={closeDetail}>
        <Pressable style={styles.overlay} onPress={closeDetail} />
        <Animated.View style={[styles.detailSheet, { transform: [{ translateY: detailSlide }] }]}>
          <View style={styles.handle} />

          {/* Top row */}
          <View style={styles.detailTopRow}>
            <TouchableOpacity style={styles.iconCircleBtn} onPress={closeDetail} activeOpacity={0.7}>
              <MaterialIcons name="close" size={20} color={DARK} />
            </TouchableOpacity>
            <Text style={styles.detailTitle}>
              {currentStop?.type === 'pickup'
                ? 'Detalhes da coleta'
                : `Entrega para ${currentStop?.name ?? ''}`}
            </Text>
            <TouchableOpacity style={styles.iconCircleBtn} activeOpacity={0.7}>
              <MaterialIcons name="phone" size={20} color={DARK} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScroll}>
            {currentStop?.type === 'pickup' ? (
              /* ---- PICKUP detail ---- */
              <>
                {/* Avatar */}
                <View style={styles.avatarCenter}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitials}>
                      {getInitials(currentStop?.name ?? '?')}
                    </Text>
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
                  onPress={() => {
                    setConfirmCode('');
                    setConfirmError('');
                    setConfirmPickupVisible(true);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.actionBtnText}>Iniciar coleta</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>Cancelar coleta</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* ---- DELIVERY detail ---- */
              <>
                {/* Package icon */}
                <View style={styles.avatarCenter}>
                  <View style={[styles.avatarCircle, { backgroundColor: GOLD }]}>
                    <MaterialIcons name="inbox" size={28} color="#fff" />
                  </View>
                </View>

                <View style={styles.deliveryNamesRow}>
                  <Text style={styles.detailName}>{currentStop?.sourceId ? 'Remetente' : ''}</Text>
                </View>

                <View style={styles.deliveryArrowRow}>
                  <Text style={styles.deliveryNameText}>
                    {/* Show sender → receiver. We store receiver in "name" for delivery stops */}
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
                  onPress={() => {
                    setConfirmCode('');
                    setConfirmError('');
                    setConfirmDeliveryVisible(true);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.actionBtnText}>Confirmar entrega</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </Animated.View>
      </Modal>

      {/* Confirm Pickup modal */}
      <Modal visible={confirmPickupVisible} transparent animationType="fade" onRequestClose={() => setConfirmPickupVisible(false)}>
        <View style={styles.centeredModalOverlay}>
          <View style={styles.centeredModal}>
            <Text style={styles.centeredModalTitle}>Confirmar coleta</Text>
            <Text style={styles.centeredModalSubtitle}>
              Insira o código informado pelo passageiro para confirmar a coleta.
            </Text>

            <Text style={styles.fieldLabel}>Código de coleta</Text>
            <TextInput
              style={styles.codeInput}
              value={confirmCode}
              onChangeText={(v) => {
                setConfirmCode(v.replace(/\D/g, '').slice(0, 4));
                setConfirmError('');
              }}
              keyboardType="numeric"
              maxLength={4}
              placeholder="0000"
              placeholderTextColor="#9CA3AF"
              textAlign="center"
            />
            {confirmError ? <Text style={styles.errorText}>{confirmError}</Text> : null}

            <TouchableOpacity style={styles.actionBtn} onPress={handleConfirmStop} activeOpacity={0.85}>
              <Text style={styles.actionBtnText}>Confirmar coleta</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setConfirmCode('');
                setConfirmError('');
                setConfirmPickupVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirm Delivery modal */}
      <Modal visible={confirmDeliveryVisible} transparent animationType="fade" onRequestClose={() => setConfirmDeliveryVisible(false)}>
        <View style={styles.centeredModalOverlay}>
          <View style={styles.centeredModal}>
            <Text style={styles.centeredModalTitle}>Confirmar entrega</Text>
            <Text style={styles.centeredModalSubtitle}>
              Insira o código informado pelo cliente para confirmar a entrega.
            </Text>

            <Text style={styles.fieldLabel}>Código de entrega</Text>
            <TextInput
              style={styles.codeInput}
              value={confirmCode}
              onChangeText={(v) => {
                setConfirmCode(v.replace(/\D/g, '').slice(0, 4));
                setConfirmError('');
              }}
              keyboardType="numeric"
              maxLength={4}
              placeholder="0000"
              placeholderTextColor="#9CA3AF"
              textAlign="center"
            />
            {confirmError ? <Text style={styles.errorText}>{confirmError}</Text> : null}

            <TouchableOpacity style={styles.actionBtn} onPress={handleConfirmStop} activeOpacity={0.85}>
              <Text style={styles.actionBtnText}>Confirmar entrega</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setConfirmCode('');
                setConfirmError('');
                setConfirmDeliveryVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Finalize Trip modal (bottom sheet style) */}
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
              <Text style={styles.finalizeSummaryValue}>18.4 km</Text>
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

          {/* Expense attachment */}
          <TouchableOpacity
            style={[styles.expenseBox, expenseAttached && styles.expenseBoxAttached]}
            onPress={() => setExpenseAttached(!expenseAttached)}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="description"
              size={24}
              color={expenseAttached ? GOLD : '#9CA3AF'}
            />
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

      {/* Trip Completed overlay */}
      <Modal visible={completedVisible} transparent={false} animationType="fade" onRequestClose={() => {}}>
        <SafeAreaView style={styles.completedContainer} edges={[]}>
          <StatusBar style="dark" />
          <ScrollView contentContainerStyle={styles.completedScroll} showsVerticalScrollIndicator={false}>
            {/* Success icon */}
            <View style={styles.completedIconCircle}>
              <MaterialIcons name="check" size={40} color="#fff" />
            </View>

            <Text style={styles.completedTitle}>Viagem Concluída!</Text>
            <Text style={styles.completedSubtitle}>
              Todas as entregas foram realizadas com sucesso
            </Text>

            {/* Stats */}
            <View style={styles.completedStatsRow}>
              <View style={styles.completedStatItem}>
                <Text style={styles.completedStatValue}>
                  {trip?.departure_at ? formatDuration(trip.departure_at, new Date()) : '—'}
                </Text>
                <Text style={styles.completedStatLabel}>Tempo total</Text>
              </View>
              <View style={styles.completedStatDivider} />
              <View style={styles.completedStatItem}>
                <Text style={styles.completedStatValue}>18.4 km</Text>
                <Text style={styles.completedStatLabel}>Distância percorrida</Text>
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

            {/* Rating */}
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

  // Map markers
  mapMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },

  // Left sidebar
  sidebar: {
    position: 'absolute',
    left: 12,
    top: 80,
    gap: 8,
  },
  sidebarBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Mini bottom sheet
  miniSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  miniSheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stopTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#FEF9C3',
    borderRadius: 12,
  },
  stopTypeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  stopTypePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  etaBadge: {
    backgroundColor: DARK,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  etaBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  miniSheetName: {
    fontSize: 20,
    fontWeight: '700',
    color: DARK,
    marginBottom: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressText: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: GOLD,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'right',
  },

  // Finalize float button (when all stops done)
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

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  // Detail / Finalize bottom sheet
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
  detailScroll: {
    paddingBottom: 16,
  },
  avatarCenter: {
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  detailName: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK,
    textAlign: 'center',
    marginBottom: 4,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginBottom: 16,
  },
  detailMetaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: DARK,
    lineHeight: 22,
  },
  deliveryNamesRow: {
    alignItems: 'center',
    marginBottom: 4,
  },
  deliveryArrowRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  deliveryNameText: {
    fontSize: 15,
    color: '#374151',
  },

  // Action buttons
  actionBtn: {
    backgroundColor: DARK,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },

  // Centered confirm modals
  centeredModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
  },
  centeredModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  centeredModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: DARK,
    marginBottom: 8,
  },
  centeredModalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK,
    marginTop: 12,
    marginBottom: 8,
  },
  codeInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '700',
    color: DARK,
    letterSpacing: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 6,
  },

  // Finalize summary
  finalizeSummaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
  },
  finalizeSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  finalizeSummaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  finalizeSummaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK,
  },
  finalizeDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
  expenseBox: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  expenseBoxAttached: {
    borderColor: GOLD,
    backgroundColor: '#FEF9C3',
  },
  expenseText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  expenseOptional: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    marginBottom: 8,
  },

  // Trip completed overlay
  completedContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  completedScroll: {
    padding: 24,
    alignItems: 'center',
  },
  completedIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: DARK,
    textAlign: 'center',
    marginBottom: 8,
  },
  completedSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  completedStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  completedStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  completedStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: DARK,
    marginBottom: 2,
  },
  completedStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  completedStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E5E7EB',
  },
  ratingQuestion: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK,
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  ratingHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  commentInput: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: DARK,
    minHeight: 100,
  },
});
