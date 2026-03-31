import { useState, useEffect, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { Text } from '../../components/Text';
import { AnimatedBottomSheet } from '../../components/AnimatedBottomSheet';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SupportSheet } from '../../components/SupportSheet';
import {
  MapboxMap,
  MapboxMarker,
  MapboxPolyline,
  regionFromOriginDestination,
  isValidTripCoordinate,
} from '../../components/mapbox';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ActivitiesStackParamList } from '../../navigation/ActivitiesStackTypes';
import { supabase } from '../../lib/supabase';
import { getRouteWithDuration, formatDuration, type RoutePoint } from '../../lib/route';
import { DriverEtaMarkerIcon } from '../../components/DriverEtaMarkerIcon';
import { getAvailableTimeSlots, ALL_TIME_SLOTS, toISODate } from '../../lib/dateTimeSlots';
import { StatusBadge, bookingStatusToBadge } from '../../components/StatusBadge';

type Props = NativeStackScreenProps<ActivitiesStackParamList, 'TripDetail'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDetailDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const months = 'Jan Fev Mar Abr Mai Jun Jul Ago Set Out Nov Dez'.split(' ');
  const month = months[d.getMonth()];
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${day} ${month} • ${hours}:${minutes}`;
}

type BookingDetail = {
  id: string;
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  amount_cents: number;
  status: string;
  created_at: string;
  departure_time: string;
  arrival_time: string;
  driver_name: string;
  driver_avatar_url: string | null;
};

export function TripDetailScreen({ navigation, route }: Props) {
  const bookingId = route.params?.bookingId ?? '';
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeCoords, setRouteCoords] = useState<RoutePoint[] | null>(null);
  const [routeDuration, setRouteDuration] = useState<string | null>(null);
  const [showCancelTripModal, setShowCancelTripModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showRescheduleSheet, setShowRescheduleSheet] = useState(false);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<string | null>(null);
  const [supportSheetVisible, setSupportSheetVisible] = useState(false);
  const insets = useSafeAreaInsets();

  async function handleCancelTrip() {
    setCancelLoading(true);
    try {
      await supabase
        .from('bookings')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() } as never)
        .eq('id', bookingId);
      setShowCancelTripModal(false);
      navigation.goBack();
    } finally {
      setCancelLoading(false);
    }
  }

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: booking, error: bookErr } = await supabase
        .from('bookings')
        .select('id, origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng, amount_cents, status, created_at, scheduled_trip_id')
        .eq('id', bookingId)
        .eq('user_id', user.id)
        .single();
      if (cancelled || bookErr || !booking) {
        setLoading(false);
        return;
      }
      const { data: trip } = await supabase
        .from('scheduled_trips')
        .select('departure_at, arrival_at, driver_id')
        .eq('id', booking.scheduled_trip_id)
        .single();
      let driverName = 'Motorista';
      let driverAvatarUrl: string | null = null;
      if (trip?.driver_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', trip.driver_id)
          .single();
        driverName = profile?.full_name ?? driverName;
        driverAvatarUrl = profile?.avatar_url ?? null;
      }
      const depTime = trip?.departure_at ? new Date(trip.departure_at).toTimeString().slice(0, 5) : '—';
      const arrTime = trip?.arrival_at ? new Date(trip.arrival_at).toTimeString().slice(0, 5) : '—';
      setDetail({
        id: booking.id,
        origin_address: booking.origin_address,
        origin_lat: booking.origin_lat,
        origin_lng: booking.origin_lng,
        destination_address: booking.destination_address,
        destination_lat: booking.destination_lat,
        destination_lng: booking.destination_lng,
        amount_cents: booking.amount_cents,
        status: booking.status,
        created_at: booking.created_at,
        departure_time: depTime,
        arrival_time: arrTime,
        driver_name: driverName,
        driver_avatar_url: driverAvatarUrl,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  useEffect(() => {
    if (
      !detail ||
      !isValidTripCoordinate(detail.origin_lat, detail.origin_lng) ||
      !isValidTripCoordinate(detail.destination_lat, detail.destination_lng)
    ) {
      return;
    }
    let cancelled = false;
    getRouteWithDuration(
      { latitude: detail.origin_lat, longitude: detail.origin_lng },
      { latitude: detail.destination_lat, longitude: detail.destination_lng },
    ).then((result) => {
      if (!cancelled && result) {
        setRouteCoords(result.coordinates);
        if (result.durationSeconds > 0) setRouteDuration(formatDuration(result.durationSeconds));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [detail?.origin_lat, detail?.origin_lng, detail?.destination_lat, detail?.destination_lng]);

  const mapRegion = useMemo(() => {
    if (!detail) return null;
    return regionFromOriginDestination(
      detail.origin_lat,
      detail.origin_lng,
      detail.destination_lat,
      detail.destination_lng,
    );
  }, [detail]);

  const hasValidMapCoords = mapRegion != null;

  const isInProgress = detail?.status && !['paid', 'cancelled'].includes(detail.status);
  const isCompleted = detail?.status === 'paid';
  const driverOnWay = detail?.status && ['confirmed', 'in_progress'].includes(detail.status);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="close" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhes da Viagem</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.black} />
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="close" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhes da Viagem</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.placeholder}>Viagem não encontrada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const avatarUri = detail.driver_avatar_url
    ? (detail.driver_avatar_url.startsWith('http')
        ? detail.driver_avatar_url
        : `${supabaseUrl}/storage/v1/object/public/avatars/${detail.driver_avatar_url}`)
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="close" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes da Viagem</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mapWrap}>
          {!hasValidMapCoords ? (
            <View style={styles.mapLoading}>
              <ActivityIndicator size="large" color={COLORS.black} />
              <Text style={styles.mapLoadingText}>Carregando mapa…</Text>
            </View>
          ) : (
            <>
              <MapboxMap style={styles.map} initialRegion={mapRegion!} scrollEnabled={false} showControls>
                {routeCoords && routeCoords.length > 0 && (
                  <MapboxPolyline coordinates={routeCoords} strokeColor={COLORS.black} strokeWidth={4} />
                )}
                {driverOnWay ? (
                  <MapboxMarker
                    id="origin"
                    coordinate={{ latitude: detail.origin_lat, longitude: detail.origin_lng }}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <DriverEtaMarkerIcon eta={routeDuration ?? undefined} />
                  </MapboxMarker>
                ) : (
                  <MapboxMarker
                    id="origin"
                    coordinate={{ latitude: detail.origin_lat, longitude: detail.origin_lng }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    icon={require('../../../assets/icons/icon-partida.png')}
                    iconSize={17}
                  />
                )}
                <MapboxMarker
                  id="destination"
                  coordinate={{ latitude: detail.destination_lat, longitude: detail.destination_lng }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  icon={require('../../../assets/icons/icon-destino.png')}
                  iconSize={14}
                />
              </MapboxMap>
              <TouchableOpacity style={styles.trackButton} activeOpacity={0.8}>
                <MaterialIcons name="explore" size={20} color={COLORS.neutral700} />
                <Text style={styles.trackButtonText}>Acompanhar em tempo real</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardStatusRow}>
            <StatusBadge variant={bookingStatusToBadge(detail.status)} />
          </View>
          <Text style={styles.tripId}>VG{detail.id.slice(-6).toUpperCase()}</Text>
          <Text style={styles.cardDate}>{formatDetailDate(detail.created_at)}</Text>
          <Text style={styles.cardSummary}>1 passageiro • 0 encomenda</Text>
          <Text style={styles.cardSummary}>Ocupação do bagageiro: —</Text>
          <View style={styles.cardTitleRow}>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTitle}>Corrida TakeMe</Text>
              <Text style={styles.cardSubtitle}>com {detail.driver_name}</Text>
            </View>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.driverAvatar} />
            ) : (
              <View style={[styles.driverAvatar, styles.driverAvatarFallback]}>
                <Text style={styles.driverAvatarInitials}>{getInitials(detail.driver_name)}</Text>
              </View>
            )}
          </View>
          <View style={styles.cardStatusRow}>
            <Text style={styles.cardPrice}>R$ {(detail.amount_cents / 100).toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.receiptButton} activeOpacity={0.8}>
            <MaterialIcons name="receipt" size={20} color={COLORS.neutral700} />
            <Text style={styles.receiptButtonText}>Recibo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.routeSection}>
          <View style={styles.routeRow}>
            <View style={styles.routeIconCircle} />
            <Text style={styles.routeAddress} numberOfLines={2}>{detail.origin_address}</Text>
            <Text style={styles.routeTime}>{detail.departure_time}</Text>
          </View>
          <View style={styles.routeRow}>
            <View style={styles.routeIconSquare} />
            <Text style={styles.routeAddress} numberOfLines={2}>{detail.destination_address}</Text>
            <Text style={styles.routeTime}>{detail.arrival_time}</Text>
          </View>
        </View>

        {!isCompleted && (
          <>
            <Text style={styles.sectionHeading}>Passageiros</Text>
            <View style={styles.placeholderSection}>
              <Text style={styles.placeholderSectionText}>Nenhum passageiro listado</Text>
            </View>
            <Text style={styles.sectionHeading}>Encomenda</Text>
            <View style={styles.placeholderSection}>
              <Text style={styles.placeholderSectionText}>Nenhuma encomenda</Text>
            </View>
          </>
        )}

        <Text style={styles.sectionHeading}>Despesas</Text>
        <TouchableOpacity style={styles.uploadExpenseBox} activeOpacity={0.8}>
          <MaterialIcons name="cloud-upload" size={32} color={COLORS.neutral700} />
          <Text style={styles.uploadExpenseText}>Envie o comprovante da despesa</Text>
        </TouchableOpacity>

        {isCompleted && (
          <View style={styles.resumoSection}>
            <Text style={styles.sectionHeading}>Resumo final</Text>
            <View style={styles.resumoCard}>
              <Text style={styles.resumoLabel}>Total recebido</Text>
              <Text style={styles.resumoValue}>R$ {(detail.amount_cents / 100).toFixed(2)}</Text>
            </View>
            <Text style={styles.resumoMeta}>Duração: —</Text>
            <Text style={styles.resumoMeta}>Distância: —</Text>
          </View>
        )}

        <View style={styles.actionsSection}>
          <View style={styles.actionRow}>
            <MaterialIcons name="card-giftcard" size={20} color={COLORS.neutral700} />
            <Text style={styles.actionLabel}>Nenhuma gorjeta enviada</Text>
            <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
              <Text style={styles.actionButtonText}>Gorjeta</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.actionRow}>
            <MaterialIcons name="star-outline" size={20} color={COLORS.neutral700} />
            <Text style={styles.actionLabel}>Sem avaliação</Text>
            <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
              <Text style={styles.actionButtonText}>Avaliar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isInProgress && (
          <>
            <TouchableOpacity style={styles.primaryActionButton} activeOpacity={0.8}>
              <Text style={styles.primaryActionButtonText}>Iniciar Viagem</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} activeOpacity={0.8} onPress={() => setShowRescheduleSheet(true)}>
              <Text style={styles.secondaryActionButtonText}>Reagendar viagem</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} activeOpacity={0.8} onPress={() => setShowCancelTripModal(true)}>
              <Text style={styles.cancelButtonText}>Cancelar viagem</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal visible={showCancelTripModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalBox}>
            <Text style={styles.confirmModalTitle}>Tem certeza que deseja cancelar esta viagem?</Text>
            <Text style={styles.confirmModalSubtitle}>O passageiro será notificado imediatamente.</Text>
            <TouchableOpacity style={styles.confirmModalPrimary} activeOpacity={0.8} onPress={() => setShowCancelTripModal(false)} disabled={cancelLoading}>
              <Text style={styles.confirmModalPrimaryText}>Continuar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmModalSecondary} activeOpacity={0.8} onPress={handleCancelTrip} disabled={cancelLoading}>
              {cancelLoading ? (
                <ActivityIndicator size="small" color="#dc2626" />
              ) : (
                <Text style={styles.confirmModalSecondaryText}>Cancelar viagem</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AnimatedBottomSheet visible={showRescheduleSheet} onClose={() => { setShowRescheduleSheet(false); setSelectedRescheduleSlot(null); }}>
        <Text style={styles.rescheduleTitle}>Tem certeza que deseja reagendar esta viagem?</Text>
        <Text style={styles.rescheduleSubtitle}>Escolha um novo horário de saída para esta viagem.</Text>
        <Text style={styles.rescheduleWarning}>O reagendamento só é permitido no mesmo dia da data original.</Text>
        <Text style={styles.sectionHeading}>Novo horário de saída</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rescheduleSlotsContent}>
          {detail && getAvailableTimeSlots(toISODate(new Date(detail.created_at)), ALL_TIME_SLOTS).map((slot) => {
            const timeLabel = slot.label.split(' - ')[0];
            const isSelected = selectedRescheduleSlot === slot.label;
            return (
              <TouchableOpacity
                key={slot.label}
                style={[styles.rescheduleSlotChip, isSelected && styles.rescheduleSlotChipSelected]}
                onPress={() => setSelectedRescheduleSlot(slot.label)}
                activeOpacity={0.8}
              >
                <Text style={[styles.rescheduleSlotText, isSelected && styles.rescheduleSlotTextSelected]}>{timeLabel}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity style={styles.confirmModalPrimary} activeOpacity={0.8} onPress={() => { setShowRescheduleSheet(false); setSelectedRescheduleSlot(null); /* TODO: confirm reschedule */ }}>
          <Text style={styles.confirmModalPrimaryText}>Confirmar reagendamento</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.confirmModalSecondary} activeOpacity={0.8} onPress={() => { setShowRescheduleSheet(false); setSelectedRescheduleSlot(null); }}>
          <Text style={styles.confirmModalSecondaryText}>Cancelar</Text>
        </TouchableOpacity>
      </AnimatedBottomSheet>

      <TouchableOpacity style={[styles.fab, { bottom: Math.max(24, insets.bottom + 16) }]} onPress={() => setSupportSheetVisible(true)} activeOpacity={0.8}>
        <Image source={require('../../../assets/icons/icon-chat.png')} style={styles.fabIcon} />
      </TouchableOpacity>

      <SupportSheet
        visible={supportSheetVisible}
        onClose={() => setSupportSheetVisible(false)}
        showDriverChat={detail?.status != null && !['completed', 'cancelled'].includes(detail.status)}
        onOpenDriverChat={() => navigation.navigate('Chat', { contactName: 'Motorista' })}
        onOpenSupportChat={() => navigation.navigate('Chat', { contactName: 'Suporte Take Me' })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FBBF24',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabIcon: { width: 28, height: 28 },
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral300,
  },
  closeButton: { padding: 4, width: 32 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.black, flex: 1, textAlign: 'center' },
  headerSpacer: { width: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  placeholder: { fontSize: 15, color: COLORS.neutral700 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  mapWrap: { height: 200, paddingHorizontal: 24, paddingTop: 16 },
  map: { width: '100%', height: '100%', borderRadius: 12 },
  mapLoading: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapLoadingText: { fontSize: 13, color: COLORS.neutral700 },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
  },
  trackButtonText: { fontSize: 14, fontWeight: '500', color: COLORS.neutral700 },
  card: {
    marginHorizontal: 24,
    marginTop: 20,
    padding: 16,
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitleWrap: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.black },
  cardSubtitle: { fontSize: 16, fontWeight: '500', color: COLORS.black, marginTop: 2 },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FBBF24',
    overflow: 'hidden',
  },
  driverAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  driverAvatarInitials: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  cardDate: { fontSize: 14, color: COLORS.neutral700, marginTop: 12 },
  cardStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  cardPrice: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  cardStatus: { fontSize: 14, fontWeight: '600' },
  cardStatusCompleted: { color: '#16a34a' },
  cardStatusProgress: { color: '#A37E38' },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
  },
  receiptButtonText: { fontSize: 14, fontWeight: '500', color: COLORS.neutral700 },
  tripId: { fontSize: 22, fontWeight: '700', color: COLORS.black, marginTop: 8 },
  cardSummary: { fontSize: 14, color: COLORS.neutral700, marginTop: 4 },
  sectionHeading: { fontSize: 16, fontWeight: '700', color: COLORS.black, marginHorizontal: 24, marginTop: 20, marginBottom: 8 },
  placeholderSection: { marginHorizontal: 24, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: COLORS.neutral300, borderRadius: 10 },
  placeholderSectionText: { fontSize: 14, color: COLORS.neutral700 },
  uploadExpenseBox: {
    marginHorizontal: 24,
    marginTop: 4,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.neutral400,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadExpenseText: { fontSize: 14, color: COLORS.neutral700 },
  resumoSection: { marginHorizontal: 24, marginTop: 20 },
  resumoCard: { backgroundColor: COLORS.neutral300, padding: 16, borderRadius: 12, marginBottom: 8 },
  resumoLabel: { fontSize: 14, color: COLORS.neutral700 },
  resumoValue: { fontSize: 24, fontWeight: '700', color: COLORS.black, marginTop: 4 },
  resumoMeta: { fontSize: 14, color: COLORS.neutral700, marginTop: 4 },
  routeSection: { marginHorizontal: 24, marginTop: 24, gap: 16 },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeIconCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.neutral700,
  },
  routeIconSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: COLORS.neutral700,
  },
  routeAddress: { flex: 1, fontSize: 14, color: COLORS.black },
  routeTime: { fontSize: 14, fontWeight: '600', color: COLORS.black },
  actionsSection: { marginHorizontal: 24, marginTop: 24, gap: 12 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionLabel: { flex: 1, fontSize: 14, color: COLORS.neutral700 },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.neutral300,
    borderRadius: 8,
  },
  actionButtonText: { fontSize: 14, fontWeight: '500', color: COLORS.black },
  primaryActionButton: {
    marginHorizontal: 24,
    marginTop: 24,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.black,
  },
  primaryActionButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  secondaryActionButton: {
    marginHorizontal: 24,
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryActionButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  cancelButton: {
    marginHorizontal: 24,
    marginTop: 8,
    paddingVertical: 16,
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#dc2626' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmModalBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 24,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmModalSubtitle: {
    fontSize: 14,
    color: COLORS.neutral700,
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmModalPrimary: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: COLORS.black,
    alignItems: 'center',
  },
  confirmModalPrimaryText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  confirmModalSecondary: {
    marginTop: 12,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
  },
  confirmModalSecondaryText: { fontSize: 16, fontWeight: '600', color: '#dc2626' },
  rescheduleSheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 24,
    marginTop: 'auto',
  },
  sheetClose: { position: 'absolute', top: 16, right: 16, zIndex: 1 },
  rescheduleTitle: { fontSize: 18, fontWeight: '700', color: COLORS.black, marginBottom: 8 },
  rescheduleSubtitle: { fontSize: 14, color: COLORS.neutral700, marginBottom: 4 },
  rescheduleWarning: { fontSize: 13, color: COLORS.neutral700, fontStyle: 'italic', marginBottom: 16 },
  rescheduleSlotsContent: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  rescheduleSlotChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.neutral300,
  },
  rescheduleSlotChipSelected: { backgroundColor: '#FBBF24' },
  rescheduleSlotText: { fontSize: 14, fontWeight: '500', color: COLORS.black },
  rescheduleSlotTextSelected: { color: COLORS.black },
});
