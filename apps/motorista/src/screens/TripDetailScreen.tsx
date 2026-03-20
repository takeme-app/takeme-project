import { useState, useCallback, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import { Text } from '../components/Text';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { SCREEN_TOP_EXTRA_PADDING } from '../theme/screenLayout';
import { MapboxMap, MapboxMarker, MapboxPolyline } from '../components/mapbox';
import { useBottomSheetDrag } from '../hooks/useBottomSheetDrag';
import * as DocumentPicker from 'expo-document-picker';

type Props = NativeStackScreenProps<RootStackParamList, 'TripDetail'>;

const GOLD = '#C9A227';
const PT_MONTHS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

// ─── Types ─────────────────────────────────────────────────────────────────────

type Trip = {
  id: string;
  origin_address: string;
  destination_address: string;
  departure_at: string;
  arrival_at: string | null;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  bags_available: number | null;
  status: string;
  amount_cents: number | null;
};

type Profile = {
  full_name: string | null;
  avatar_url: string | null;
  rating: number | null;
};

type Booking = {
  id: string;
  passenger_count: number | null;
  bags_count: number | null;
  status: string;
  amount_cents: number | null;
  profiles: Profile | null;
};

type Shipment = {
  id: string;
  description: string | null;
  size: string | null;
  notes: string | null;
  origin_address: string | null;
  destination_address: string | null;
  sender_name: string | null;
  receiver_name: string | null;
};

type DocumentAsset = {
  name: string;
  uri: string;
  mimeType?: string | null;
  size?: number | null;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const mon = PT_MONTHS[d.getMonth()];
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${mon} • ${hh}:${mm}`;
  } catch {
    return '—';
  }
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  } catch {
    return '—';
  }
}

function shortAddr(addr: string): string {
  return addr.split(',')[0]?.trim() ?? addr;
}

function tripCode(id: string): string {
  return 'VG' + id.replace(/-/g, '').slice(0, 6).toUpperCase();
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function durationLabel(departure: string, arrival: string | null): string {
  if (!arrival) return '—';
  try {
    const diffMs = new Date(arrival).getTime() - new Date(departure).getTime();
    if (diffMs <= 0) return '—';
    const totalMin = Math.round(diffMs / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m}min`;
    return m === 0 ? `${h}h` : `${h}h ${m}min`;
  } catch {
    return '—';
  }
}

function sizeLabel(size: string | null): string {
  if (size === 'pequeno') return 'Pequeno';
  if (size === 'medio') return 'Médio';
  if (size === 'grande') return 'Grande';
  return size ?? '—';
}

// Generate time slots on the same day as departure_at
function generateTimeSlots(departureSoIso: string): string[] {
  try {
    const base = new Date(departureSoIso);
    const slots: string[] = [];
    for (let h = 6; h <= 22; h++) {
      for (const m of [0, 30]) {
        const d = new Date(base);
        d.setHours(h, m, 0, 0);
        slots.push(d.toISOString());
      }
    }
    return slots;
  } catch {
    return [];
  }
}

// ─── Bottom Sheet Shell ────────────────────────────────────────────────────────

function BottomSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const { dragY, panHandlers, resetDrag } = useBottomSheetDrag(onClose);

  const prevVisible = useRef(visible);
  if (prevVisible.current !== visible) {
    prevVisible.current = visible;
    if (visible) {
      resetDrag();
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 400, duration: 220, useNativeDriver: true }).start();
    }
  }

  if (!visible) return null;

  const translateY = Animated.add(slideAnim, dragY);

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        {/* Drag handle */}
        <View style={styles.sheetHandleWrap} {...panHandlers}>
          <View style={styles.sheetHandle} />
        </View>
        {children}
      </Animated.View>
    </Modal>
  );
}

// ─── Cancel Modal ──────────────────────────────────────────────────────────────

function CancelModal({
  visible,
  onClose,
  onConfirm,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>Cancelar viagem</Text>
        <Text style={styles.sheetBody}>
          Tem certeza que deseja cancelar esta viagem? Esta ação não pode ser desfeita e os
          passageiros serão notificados.
        </Text>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={onClose}
          activeOpacity={0.8}
          disabled={loading}
        >
          <Text style={styles.btnPrimaryText}>Continuar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnCancel}
          onPress={onConfirm}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <Text style={styles.btnCancelText}>Cancelar viagem</Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

// ─── Reschedule Modal ──────────────────────────────────────────────────────────

function RescheduleModal({
  visible,
  onClose,
  onConfirm,
  loading,
  currentDeparture,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (newIso: string) => void;
  loading: boolean;
  currentDeparture: string;
}) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const slots = generateTimeSlots(currentDeparture);

  const handleConfirm = () => {
    if (!selectedSlot) return;
    onConfirm(selectedSlot);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>Reagendar viagem</Text>
        <Text style={styles.sheetBodySmall}>Escolha um novo horário...</Text>
        <Text style={styles.sheetHint}>O reagendamento só é permitido no mesmo dia.</Text>

        {/* Time slot chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.slotScroll}
          contentContainerStyle={styles.slotScrollContent}
        >
          {slots.map((slot) => {
            const isSelected = slot === selectedSlot;
            return (
              <TouchableOpacity
                key={slot}
                style={[styles.slotChip, isSelected && styles.slotChipSelected]}
                onPress={() => setSelectedSlot(slot)}
                activeOpacity={0.75}
              >
                <Text style={[styles.slotChipText, isSelected && styles.slotChipTextSelected]}>
                  {formatTime(slot)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={[styles.btnPrimary, !selectedSlot && styles.btnPrimaryDisabled]}
          onPress={handleConfirm}
          activeOpacity={0.8}
          disabled={loading || !selectedSlot}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.btnPrimaryText}>Confirmar reagendamento</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnCancel} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.btnGrayText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

// ─── Support Modal ─────────────────────────────────────────────────────────────

function SupportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>Como podemos ajudar?</Text>

        {([
          { label: 'Ligar', icon: 'phone', action: () => {} },
          { label: 'Chat', icon: 'headset-mic', action: () => {} },
          { label: 'WhatsApp', icon: 'chat', action: () => {} },
        ] as { label: string; icon: string; action: () => void }[]).map((opt) => (
          <TouchableOpacity
            key={opt.label}
            style={styles.supportOption}
            onPress={opt.action}
            activeOpacity={0.75}
          >
            <View style={styles.supportIconCircle}>
              <MaterialIcons name={opt.icon as never} size={22} color={GOLD} />
            </View>
            <Text style={styles.supportOptionLabel}>{opt.label}</Text>
            <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
      </View>
    </BottomSheet>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export function TripDetailScreen({ route, navigation }: Props) {
  const { tripId } = route.params;

  const [loadingTrip, setLoadingTrip] = useState(true);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);

  const [cancelVisible, setCancelVisible] = useState(false);
  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [supportVisible, setSupportVisible] = useState(false);

  const [cancelLoading, setCancelLoading] = useState(false);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);

  const [expenseDoc, setExpenseDoc] = useState<DocumentAsset | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoadingTrip(true);

    const [{ data: tripData }, { data: bookingsData }, { data: shipmentsData }] =
      await Promise.all([
        supabase
          .from('scheduled_trips')
          .select(
            'id, origin_address, destination_address, departure_at, arrival_at, origin_lat, origin_lng, destination_lat, destination_lng, bags_available, status, amount_cents'
          )
          .eq('id', tripId)
          .single(),
        supabase
          .from('bookings')
          .select(
            'id, passenger_count, bags_count, status, amount_cents, profiles(full_name, avatar_url, rating)'
          )
          .eq('scheduled_trip_id', tripId)
          .in('status', ['confirmed', 'paid']),
        supabase
          .from('shipments')
          .select(
            'id, description, size, notes, origin_address, destination_address, sender_name, receiver_name'
          )
          .eq('scheduled_trip_id', tripId),
      ]);

    if (tripData) setTrip(tripData as Trip);
    if (bookingsData) setBookings(bookingsData as Booking[]);
    if (shipmentsData) setShipments(shipmentsData as Shipment[]);

    setLoadingTrip(false);
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // ── Actions ───────────────────────────────────────────────────────────────────

  const handleStartTrip = async () => {
    if (!trip) return;
    setStartLoading(true);
    const { error } = await supabase
      .from('scheduled_trips')
      .update({ status: 'active', updated_at: new Date().toISOString() } as never)
      .eq('id', trip.id);
    setStartLoading(false);
    if (!error) {
      navigation.navigate('ActiveTrip', { tripId: trip.id });
    }
  };

  const handleCancelConfirm = async () => {
    if (!trip) return;
    setCancelLoading(true);
    const { error } = await supabase
      .from('scheduled_trips')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() } as never)
      .eq('id', trip.id);
    setCancelLoading(false);
    if (!error) {
      setCancelVisible(false);
      setTrip((prev) => (prev ? { ...prev, status: 'cancelled' } : prev));
    }
  };

  const handleRescheduleConfirm = async (newIso: string) => {
    if (!trip) return;
    setRescheduleLoading(true);
    const { error } = await supabase
      .from('scheduled_trips')
      .update({ departure_at: newIso, updated_at: new Date().toISOString() } as never)
      .eq('id', trip.id);
    setRescheduleLoading(false);
    if (!error) {
      setRescheduleVisible(false);
      setTrip((prev) => (prev ? { ...prev, departure_at: newIso } : prev));
    }
  };

  const handlePickExpense = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setExpenseDoc({
          name: asset.name,
          uri: asset.uri,
          mimeType: asset.mimeType,
          size: asset.size,
        });
      }
    } catch {
      // user cancelled or error
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed' || b.status === 'paid');
  const totalPax = confirmedBookings.reduce((s, b) => s + (b.passenger_count ?? 0), 0);
  const totalBags = bookings.reduce((s, b) => s + (b.bags_count ?? 0), 0);
  const totalRevenueCents = confirmedBookings.reduce((s, b) => s + (b.amount_cents ?? 0), 0);

  const bagsCapacity = trip?.bags_available ?? 0;
  const bagsOccupancyPct =
    bagsCapacity > 0 ? Math.round((totalBags / bagsCapacity) * 100) : 0;

  const initialRegion = trip
    ? {
        latitude: (trip.origin_lat + trip.destination_lat) / 2,
        longitude: (trip.origin_lng + trip.destination_lng) / 2,
        latitudeDelta: Math.abs(trip.destination_lat - trip.origin_lat) * 2 + 0.02,
        longitudeDelta: Math.abs(trip.destination_lng - trip.origin_lng) * 2 + 0.02,
      }
    : { latitude: -7.33, longitude: -35.33, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  const routeCoords = trip
    ? [
        { latitude: trip.origin_lat, longitude: trip.origin_lng },
        { latitude: trip.destination_lat, longitude: trip.destination_lng },
      ]
    : [];

  // ── Status badge ──────────────────────────────────────────────────────────────

  function StatusBadge({ status }: { status: string }) {
    type BadgeCfg = { bg: string; text: string; label: string };
    const cfg: BadgeCfg =
      status === 'completed'
        ? { bg: '#D1FAE5', text: '#065F46', label: 'Concluída' }
        : status === 'active'
        ? { bg: '#FEF3C7', text: '#92400E', label: 'Em andamento' }
        : status === 'cancelled'
        ? { bg: '#FEE2E2', text: '#B91C1C', label: 'Cancelada' }
        : { bg: '#FEF3C7', text: '#92400E', label: 'Em análise' };

    return (
      <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
        <Text style={[styles.statusBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loadingTrip) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
            <MaterialIcons name="close" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhe da viagem</Text>
          <View style={styles.closeBtnSpacer} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Viagem não encontrada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isScheduled = trip.status === 'scheduled';
  const isActive = trip.status === 'active';
  const isCompleted = trip.status === 'completed';
  const showPassengerSection = (isScheduled || isActive) && confirmedBookings.length > 0;
  const showShipmentSection = (isScheduled || isActive) && shipments.length > 0;
  const showContactInfo = isCompleted && shipments.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* ── Fixed Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="close" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhe da viagem</Text>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => setSupportVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="headset-mic" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* ── Scrollable content ───────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Map */}
        <View style={styles.mapContainer}>
          <MapboxMap initialRegion={initialRegion} style={styles.map} scrollEnabled={false}>
            <MapboxPolyline coordinates={routeCoords} strokeColor={GOLD} strokeWidth={4} />

            {/* Origin marker – filled circle */}
            <MapboxMarker
              id="origin"
              coordinate={{ latitude: trip.origin_lat, longitude: trip.origin_lng }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.markerOrigin} />
            </MapboxMarker>

            {/* Destination marker – square/diamond */}
            <MapboxMarker
              id="destination"
              coordinate={{ latitude: trip.destination_lat, longitude: trip.destination_lng }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.markerDest} />
            </MapboxMarker>
          </MapboxMap>
        </View>

        {/* ── Details body ──────────────────────────────────────────────────── */}
        <View style={styles.body}>

          {/* Status + code + date */}
          <StatusBadge status={trip.status} />

          <Text style={styles.tripCode}>{tripCode(trip.id)}</Text>
          <Text style={styles.dateLabel}>{formatDateTime(trip.departure_at)}</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            {totalPax > 0 ? `${totalPax} passageiro${totalPax !== 1 ? 's' : ''}` : ''}
            {totalPax > 0 && totalBags > 0 ? ' • ' : ''}
            {totalBags > 0 ? `${totalBags} encomenda${totalBags !== 1 ? 's' : ''}` : ''}
          </Text>

          {bagsCapacity > 0 && (
            <Text style={styles.bagCapacity}>
              Ocupação do bagageiro: {bagsOccupancyPct}%
            </Text>
          )}

          {/* ── Route timeline ─────────────────────────────────────────────── */}
          <View style={styles.timeline}>
            {/* Origin */}
            <View style={styles.timelineRow}>
              <View style={styles.timelineLeft}>
                <View style={styles.timelineDotOrigin} />
                <View style={styles.timelineConnector} />
              </View>
              <View style={styles.timelineInfo}>
                <Text style={styles.timelineAddr} numberOfLines={2}>
                  {trip.origin_address}
                </Text>
                <Text style={styles.timelineTime}>{formatTime(trip.departure_at)}</Text>
              </View>
            </View>

            {/* Destination */}
            <View style={styles.timelineRow}>
              <View style={styles.timelineLeft}>
                <View style={styles.timelineDotDest} />
              </View>
              <View style={styles.timelineInfo}>
                <Text style={styles.timelineAddr} numberOfLines={2}>
                  {trip.destination_address}
                </Text>
                <Text style={styles.timelineTime}>{formatTime(trip.arrival_at)}</Text>
              </View>
            </View>
          </View>

          {/* ── Passengers section ─────────────────────────────────────────── */}
          {showPassengerSection && (
            <>
              <Text style={styles.sectionTitle}>Passageiros</Text>
              {confirmedBookings.map((booking) => {
                const profile = booking.profiles;
                const initials = getInitials(profile?.full_name);
                const pax = booking.passenger_count ?? 0;
                const bags = booking.bags_count ?? 0;
                const labelParts: string[] = [];
                if (pax > 0) labelParts.push(`${pax} pax`);
                if (bags > 0) labelParts.push(`${bags} bag`);
                return (
                  <View key={booking.id} style={styles.passengerRow}>
                    {/* Avatar */}
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>

                    {/* Name + rating */}
                    <View style={styles.passengerInfo}>
                      <Text style={styles.passengerName} numberOfLines={1}>
                        {profile?.full_name ?? 'Passageiro'}
                      </Text>
                      <View style={styles.ratingRow}>
                        <MaterialIcons name="star" size={14} color={GOLD} />
                        <Text style={styles.ratingText}>
                          {profile?.rating != null ? profile.rating.toFixed(1) : '—'}
                        </Text>
                        {labelParts.length > 0 && (
                          <Text style={styles.bagLabel}> • {labelParts.join(' ')}</Text>
                        )}
                      </View>
                    </View>

                    {/* Phone button */}
                    <TouchableOpacity style={styles.phoneBtn} activeOpacity={0.75}>
                      <MaterialIcons name="phone" size={20} color="#111827" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}

          {/* ── Shipments section ──────────────────────────────────────────── */}
          {showShipmentSection && (
            <>
              <Text style={styles.sectionTitle}>Encomenda</Text>
              {shipments.map((s) => (
                <View key={s.id} style={styles.shipmentCard}>
                  {/* Title row */}
                  <View style={styles.shipmentTitleRow}>
                    <MaterialIcons name="inventory-2" size={20} color="#6B7280" />
                    <Text style={styles.shipmentTitle} numberOfLines={1}>
                      {s.sender_name ?? 'Remetente'} → {s.receiver_name ?? 'Destinatário'}
                    </Text>
                  </View>

                  {/* Route */}
                  <View style={styles.shipmentRouteRow}>
                    <View style={styles.shipmentDot} />
                    <Text style={styles.shipmentAddr} numberOfLines={1}>
                      {s.origin_address ?? '—'}
                    </Text>
                  </View>
                  <View style={[styles.shipmentRouteRow, { marginBottom: 10 }]}>
                    <View style={styles.shipmentDotDest} />
                    <Text style={styles.shipmentAddr} numberOfLines={1}>
                      {s.destination_address ?? '—'}
                    </Text>
                  </View>

                  <Text style={styles.shipmentMeta}>Tamanho: {sizeLabel(s.size)}</Text>
                  {s.notes ? (
                    <Text style={styles.shipmentNotes}>Observações: {s.notes}</Text>
                  ) : null}
                </View>
              ))}
            </>
          )}

          {/* ── Despesas (all statuses) ────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Despesas</Text>
          <TouchableOpacity
            style={styles.expenseUpload}
            onPress={handlePickExpense}
            activeOpacity={0.75}
          >
            {expenseDoc ? (
              <View style={styles.expenseDocRow}>
                <MaterialIcons name="insert-drive-file" size={22} color={GOLD} />
                <Text style={styles.expenseDocName} numberOfLines={1}>
                  {expenseDoc.name}
                </Text>
                <TouchableOpacity
                  onPress={() => setExpenseDoc(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="close" size={18} color="#6B7280" />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <MaterialIcons name="upload" size={28} color="#9CA3AF" />
                <Text style={styles.expenseUploadText}>Envie o comprovante da despesa</Text>
              </>
            )}
          </TouchableOpacity>

          {/* ── Contact info (completed + has shipments) ───────────────────── */}
          {showContactInfo && (
            <>
              <Text style={styles.sectionTitle}>Informações de contato</Text>
              {shipments.map((s) => (
                <View key={s.id} style={styles.contactCard}>
                  <View style={styles.contactRow}>
                    <MaterialIcons name="person" size={18} color="#6B7280" />
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactRole}>Remetente</Text>
                      <Text style={styles.contactName}>{s.sender_name ?? '—'}</Text>
                    </View>
                  </View>
                  <View style={styles.contactDivider} />
                  <View style={styles.contactRow}>
                    <MaterialIcons name="person-outline" size={18} color="#6B7280" />
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactRole}>Destinatário</Text>
                      <Text style={styles.contactName}>{s.receiver_name ?? '—'}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ── Resumo final (completed) ───────────────────────────────────── */}
          {isCompleted && (
            <>
              <Text style={styles.sectionTitle}>Resumo final</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total recebido</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(totalRevenueCents)}</Text>
                  </View>
                  <View style={styles.summaryDividerV} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Duração</Text>
                    <Text style={styles.summaryValue}>
                      {durationLabel(trip.departure_at, trip.arrival_at)}
                    </Text>
                  </View>
                  <View style={styles.summaryDividerV} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Distância</Text>
                    <Text style={styles.summaryValue}>15km</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Bottom padding so content isn't hidden behind action buttons */}
          <View style={{ height: isCompleted ? 24 : 100 }} />
        </View>
      </ScrollView>

      {/* ── Fixed bottom actions ─────────────────────────────────────────────── */}
      {!isCompleted && trip.status !== 'cancelled' && (
        <View style={styles.bottomActions}>
          {isScheduled && (
            <TouchableOpacity
              style={styles.btnStart}
              onPress={handleStartTrip}
              activeOpacity={0.85}
              disabled={startLoading}
            >
              {startLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.btnStartText}>Iniciar Viagem</Text>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.bottomRow}>
            <TouchableOpacity
              style={[styles.btnSecondary, { flex: 1 }]}
              onPress={() => setCancelVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnCancelText}>Cancelar viagem</Text>
            </TouchableOpacity>
            {isScheduled && (
              <TouchableOpacity
                style={[styles.btnSecondary, { flex: 1 }]}
                onPress={() => setRescheduleVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnGrayText}>Reagendar viagem</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <CancelModal
        visible={cancelVisible}
        onClose={() => setCancelVisible(false)}
        onConfirm={handleCancelConfirm}
        loading={cancelLoading}
      />
      <RescheduleModal
        visible={rescheduleVisible}
        onClose={() => setRescheduleVisible(false)}
        onConfirm={handleRescheduleConfirm}
        loading={rescheduleLoading}
        currentDeparture={trip.departure_at}
      />
      <SupportModal visible={supportVisible} onClose={() => setSupportVisible(false)} />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 15, color: '#6B7280' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: SCREEN_TOP_EXTRA_PADDING,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnSpacer: { width: 36 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },

  // Map
  mapContainer: { height: 220, backgroundColor: '#E5E7EB' },
  map: { height: 220 },

  // Body
  scrollContent: { paddingBottom: 20 },
  body: { paddingHorizontal: 20 },

  // Status badge
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 20,
    marginBottom: 10,
  },
  statusBadgeText: { fontSize: 13, fontWeight: '600' },

  // Trip code + date
  tripCode: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 },
  dateLabel: { fontSize: 14, color: '#6B7280', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#374151', marginBottom: 2 },
  bagCapacity: { fontSize: 13, color: '#9CA3AF', marginBottom: 4 },

  // Timeline
  timeline: { marginTop: 20, marginBottom: 4 },
  timelineRow: { flexDirection: 'row', marginBottom: 0 },
  timelineLeft: {
    width: 24,
    alignItems: 'center',
    paddingTop: 3,
  },
  timelineDotOrigin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111827',
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    minHeight: 36,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  timelineDotDest: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#111827',
  },
  timelineInfo: { flex: 1, paddingLeft: 12, paddingBottom: 12 },
  timelineAddr: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  timelineTime: { fontSize: 13, color: '#6B7280' },

  // Section title
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    marginBottom: 12,
  },

  // Passengers
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  passengerInfo: { flex: 1 },
  passengerName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  ratingText: { fontSize: 13, color: '#6B7280', marginLeft: 2 },
  bagLabel: { fontSize: 13, color: '#9CA3AF' },
  phoneBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Shipments
  shipmentCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  shipmentTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  shipmentTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  shipmentRouteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  shipmentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#111827',
  },
  shipmentDotDest: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#111827',
  },
  shipmentAddr: { flex: 1, fontSize: 13, color: '#374151' },
  shipmentMeta: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  shipmentNotes: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  // Expense upload
  expenseUpload: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FAFAFA',
  },
  expenseUploadText: { fontSize: 14, color: '#9CA3AF' },
  expenseDocRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  expenseDocName: { flex: 1, fontSize: 14, color: '#374151' },

  // Contact
  contactCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactInfo: { flex: 1 },
  contactRole: { fontSize: 12, color: '#9CA3AF' },
  contactName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  contactDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },

  // Summary
  summaryCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  summaryDividerV: { width: 1, height: 40, backgroundColor: '#E5E7EB' },

  // Map markers
  markerOrigin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#111827',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  markerDest: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#111827',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },

  // Bottom actions
  bottomActions: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 10,
  },
  bottomRow: { flexDirection: 'row', gap: 10 },
  btnStart: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnStartText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  btnSecondary: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Buttons (shared/modal)
  btnPrimary: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnPrimaryDisabled: { opacity: 0.45 },
  btnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  btnCancel: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnCancelText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
  btnGrayText: { fontSize: 15, fontWeight: '600', color: '#374151' },

  // Bottom sheet / modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: { elevation: 16 },
    }),
  },
  sheetHandleWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  sheetContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 36 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },
  sheetBody: { fontSize: 14, color: '#6B7280', lineHeight: 22, marginBottom: 24 },
  sheetBodySmall: { fontSize: 14, color: '#374151', marginBottom: 4 },
  sheetHint: { fontSize: 13, color: '#9CA3AF', marginBottom: 16 },

  // Time slots
  slotScroll: { marginBottom: 20 },
  slotScrollContent: { gap: 8, paddingRight: 8 },
  slotChip: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
  },
  slotChipSelected: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  slotChipText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  slotChipTextSelected: { color: '#FFFFFF', fontWeight: '700' },

  // Support
  supportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  supportIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportOptionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
});
