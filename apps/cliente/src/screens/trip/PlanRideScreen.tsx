import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Modal, Pressable, Animated, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text } from '../../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripStackParamList } from '../../navigation/types';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import { getCurrentPlace } from '../../lib/location';
import { useAppAlert } from '../../contexts/AppAlertContext';
import { useCurrentLocation } from '../../contexts/CurrentLocationContext';
import { addRecentDestination } from '../../lib/recentDestinations';
import { ALL_TIME_SLOTS, getAvailableTimeSlots, toISODate, formatDateDisplayLabel } from '../../lib/dateTimeSlots';
import { loadClientScheduledTrips } from '../../lib/clientScheduledTrips';
import { formatDriverRatingLabel } from '../../lib/tripDriverDisplay';
import type { ScheduledTripItem } from './SearchTripScreen';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type Place = { address: string; latitude: number; longitude: number };

const DEFAULT_ORIGIN: Place = {
  address: 'Rua Rego Freitas, 370',
  latitude: -7.3289,
  longitude: -35.3328,
};
const DEFAULT_DESTINATION_COORDS = { latitude: -7.3305, longitude: -35.3335 };
const EDIT_SHEET_SLIDE = 400;
const TIME_SHEET_SLIDE = 450;
const ROUTE_MATCH_DEGREES = 0.15;

/** Converte slot "09:00 - 09:30" em { startMinutes, endMinutes } (minutos desde meia-noite). */
function parseTimeSlot(slot: string): { startMinutes: number; endMinutes: number } | null {
  const m = slot.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const startMinutes = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const endMinutes = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
  return { startMinutes, endMinutes };
}

/** Data ISO (YYYY-MM-DD) a partir de departure_at. */
function toISODateOnly(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

type Props = NativeStackScreenProps<TripStackParamList, 'PlanRide'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

export function PlanRideScreen({ navigation, route }: Props) {
  const { showAlert } = useAppAlert();
  const { currentPlace, refreshLocation } = useCurrentLocation();
  const [origin, setOrigin] = useState<Place>(() => {
    const o = route.params?.origin;
    if (o && o.latitude != null && o.longitude != null) return { address: o.address, latitude: o.latitude, longitude: o.longitude };
    return DEFAULT_ORIGIN;
  });
  const [destination, setDestination] = useState<Place | null>(() => {
    const d = route.params?.destination;
    if (!d?.address) return null;
    return { address: d.address, latitude: d.latitude ?? DEFAULT_DESTINATION_COORDS.latitude, longitude: d.longitude ?? DEFAULT_DESTINATION_COORDS.longitude };
  });
  const hasDestination = destination != null && destination.address.length > 0;
  const scheduledDateId = route.params?.scheduledDateId;
  const scheduledTimeSlot = route.params?.scheduledTimeSlot ?? null;
  const [dateLabel, setDateLabel] = useState(() => {
    if (scheduledDateId && scheduledTimeSlot) {
      const d = new Date(scheduledDateId + 'T12:00:00');
      const pt = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
      return `${pt} · ${scheduledTimeSlot.split(' - ')[0]}`;
    }
    const today = new Date();
    return today.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  });
  /** Data e horário usados para filtrar a lista: vêm dos params ou da seleção no sheet. */
  const [filterDateId, setFilterDateId] = useState<string>(() => scheduledDateId ?? toISODate(new Date()));
  const [filterTimeSlot, setFilterTimeSlot] = useState<string | null>(() => scheduledTimeSlot ?? null);
  const [timeSheetVisible, setTimeSheetVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>(() => toISODate(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const timeSheetOverlayOpacity = useRef(new Animated.Value(0)).current;
  const timeSheetTranslateY = useRef(new Animated.Value(TIME_SHEET_SLIDE)).current;

  const [allScheduledTrips, setAllScheduledTrips] = useState<ScheduledTripItem[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editOrigin, setEditOrigin] = useState(origin.address);
  const [editDestination, setEditDestination] = useState(destination?.address ?? '');
  const [locationLoading, setLocationLoading] = useState(false);
  const editOverlayOpacity = useRef(new Animated.Value(0)).current;
  const editSheetTranslateY = useRef(new Animated.Value(EDIT_SHEET_SLIDE)).current;

  // Quando não há origin nos params, usar localização pré-carregada do contexto (ou buscar) como origem padrão
  useEffect(() => {
    const o = route.params?.origin;
    if (o && o.latitude != null && o.longitude != null) return;
    if (currentPlace) {
      setOrigin({ address: currentPlace.address, latitude: currentPlace.latitude, longitude: currentPlace.longitude });
    } else {
      getCurrentPlace().then((place) => {
        if (place) setOrigin({ address: place.address, latitude: place.latitude, longitude: place.longitude });
      });
    }
  }, [route.params?.origin, currentPlace?.latitude, currentPlace?.longitude, currentPlace?.address]);

  useEffect(() => {
    setEditOrigin(origin.address);
    setEditDestination(destination?.address ?? '');
  }, [origin.address, destination?.address]);

  useEffect(() => {
    setSelectedTripId(null);
  }, [origin.latitude, origin.longitude, destination?.latitude, destination?.longitude]);

  useEffect(() => {
    setSelectedTripId(null);
  }, [filterDateId, filterTimeSlot]);

  useEffect(() => {
    if (!timeSheetVisible) return;
    timeSheetOverlayOpacity.setValue(0);
    timeSheetTranslateY.setValue(TIME_SHEET_SLIDE);
    Animated.sequence([
      Animated.timing(timeSheetOverlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(timeSheetTranslateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [timeSheetVisible]);

  /** Lista filtrada por ponto de partida, destino e data/hora. Só exibe viagens quando origem e destino estão definidos. */
  const scheduledTrips = useMemo(() => {
    if (!origin?.latitude || !origin?.longitude || !destination?.latitude || !destination?.longitude) return [];
    const oLat = origin.latitude;
    const oLng = origin.longitude;
    const dLat = destination.latitude;
    const dLng = destination.longitude;
    let list = allScheduledTrips.filter(
      (t) =>
        Math.abs(t.origin_lat - oLat) <= ROUTE_MATCH_DEGREES &&
        Math.abs(t.origin_lng - oLng) <= ROUTE_MATCH_DEGREES &&
        Math.abs(t.latitude - dLat) <= ROUTE_MATCH_DEGREES &&
        Math.abs(t.longitude - dLng) <= ROUTE_MATCH_DEGREES
    );
    if (filterDateId && list.length > 0) {
      list = list.filter((t) => {
        if (!t.departure_at) return false;
        const tripDate = toISODateOnly(t.departure_at);
        if (tripDate !== filterDateId) return false;
        if (filterTimeSlot) {
          const slot = parseTimeSlot(filterTimeSlot);
          if (!slot) return true;
          const dep = new Date(t.departure_at);
          const depMinutes = dep.getHours() * 60 + dep.getMinutes();
          return depMinutes >= slot.startMinutes && depMinutes < slot.endMinutes;
        }
        return true;
      });
    }
    return [...list].sort((a, b) => (a.badge === 'Take Me' ? 0 : 1) - (b.badge === 'Take Me' ? 0 : 1));
  }, [allScheduledTrips, origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude, filterDateId, filterTimeSlot]);

  useEffect(() => {
    let cancelled = false;
    setTripsLoading(true);
    setTripsError(null);
    (async () => {
      const { items, error } = await loadClientScheduledTrips();
      if (cancelled) return;
      if (error) {
        setTripsError(error);
        setAllScheduledTrips([]);
      } else {
        setAllScheduledTrips(items);
      }
      setTripsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!editModalVisible) return;
    editOverlayOpacity.setValue(0);
    editSheetTranslateY.setValue(EDIT_SHEET_SLIDE);
    Animated.sequence([
      Animated.timing(editOverlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(editSheetTranslateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [editModalVisible]);

  const openEditModal = () => {
    setEditOrigin(origin.address);
    setEditDestination(destination?.address ?? '');
    editOverlayOpacity.setValue(0);
    editSheetTranslateY.setValue(EDIT_SHEET_SLIDE);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setEditModalVisible(true));
    });
  };

  const closeEditModal = () => setEditModalVisible(false);

  const useMyLocationForOrigin = async () => {
    setLocationLoading(true);
    try {
      const place = await refreshLocation();
      if (place) {
        setOrigin({ address: place.address, latitude: place.latitude, longitude: place.longitude });
        setEditOrigin(place.address);
      } else {
        showAlert('Localização', 'Não foi possível usar sua localização. Verifique se o app tem permissão nas configurações.');
      }
    } catch {
      showAlert('Localização', 'Não foi possível obter seu endereço. Tente novamente.');
    } finally {
      setLocationLoading(false);
    }
  };

  const savePlaces = () => {
    setOrigin((prev) => ({ ...prev, address: editOrigin.trim() || prev.address }));
    const destText = editDestination.trim();
    if (destText) {
      const lat = destination?.latitude ?? DEFAULT_DESTINATION_COORDS.latitude;
      const lng = destination?.longitude ?? DEFAULT_DESTINATION_COORDS.longitude;
      setDestination({ address: destText, latitude: lat, longitude: lng });
      const city = destText.includes(', ') ? destText.split(', ').slice(-1)[0] ?? destText : destText;
      addRecentDestination({ address: destText, city, latitude: lat, longitude: lng });
    } else {
      setDestination(null);
    }
    closeEditModal();
  };

  const openTimeSheet = () => {
    setSelectedDay(toISODate(new Date()));
    setSelectedSlot(null);
    timeSheetOverlayOpacity.setValue(0);
    timeSheetTranslateY.setValue(TIME_SHEET_SLIDE);
    setTimeSheetVisible(true);
  };

  const closeTimeSheet = () => {
    timeSheetOverlayOpacity.setValue(0);
    timeSheetTranslateY.setValue(TIME_SHEET_SLIDE);
    setTimeSheetVisible(false);
    setSelectedSlot(null);
  };

  const handleSelectTime = () => {
    if (selectedSlot) {
      const d = new Date(selectedDay + 'T12:00:00');
      const pt = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
      setDateLabel(`${pt} · ${selectedSlot.split(' - ')[0]}`);
      setFilterDateId(selectedDay);
      setFilterTimeSlot(selectedSlot);
      setSelectedTripId(null);
      closeTimeSheet();
    }
  };

  const handleAgendar = useCallback(() => {
    if (!selectedTripId) return;
    const trip = scheduledTrips.find((t) => t.id === selectedTripId);
    if (!trip || !destination) return;
    navigation.navigate('ConfirmDetails', {
      scheduled_trip_id: trip.id,
      origin: { address: origin.address, latitude: origin.latitude, longitude: origin.longitude },
      destination: { address: destination.address, latitude: destination.latitude, longitude: destination.longitude },
      driver: {
        id: trip.id,
        driver_id: trip.driver_id,
        name: trip.driverName,
        rating: trip.rating,
        badge: trip.badge,
        departure: trip.departure,
        arrival: trip.arrival,
        seats: trip.seats,
        bags: trip.bags,
        amount_cents: trip.amount_cents ?? 0,
        vehicle_model: trip.vehicle_model,
        vehicle_year: trip.vehicle_year,
        vehicle_plate: trip.vehicle_plate,
        avatar_url: trip.driverAvatarUrl,
      },
      immediateTrip: false,
    });
  }, [selectedTripId, scheduledTrips, destination, origin, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Planeje sua corrida</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.dateRow} onPress={openTimeSheet} activeOpacity={0.8}>
          <MaterialIcons name="event" size={24} color={COLORS.black} />
          <Text style={styles.dateText}>{dateLabel}</Text>
          <MaterialIcons name="keyboard-arrow-down" size={24} color={COLORS.black} />
        </TouchableOpacity>

        {/* Card de rota: toque abre modal de alterar endereços (igual Procurando viagem) */}
        <TouchableOpacity style={styles.routeCard} onPress={openEditModal} activeOpacity={0.8}>
          <View style={styles.routeIconsColumn}>
            <View style={styles.routeIconOrigin}>
              <View style={styles.routeIconOriginDot} />
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeIconDestination} />
          </View>
          <View style={styles.routeAddresses}>
            <Text style={styles.routeAddress} numberOfLines={1}>{origin.address}</Text>
            <View style={styles.routeAddressDivider} />
            <Text style={[styles.routeAddress, !hasDestination && styles.routeAddressPlaceholder]} numberOfLines={1}>
              {hasDestination ? destination.address : 'Para onde?'}
            </Text>
          </View>
          <MaterialIcons name="edit" size={20} color={COLORS.neutral700} style={styles.editIcon} />
        </TouchableOpacity>

        {/* Lista filtrada por partida, destino e horário — seleção obrigatória para Agendar */}
        {tripsLoading && (
          <View style={styles.tripsLoadingWrap}>
            <ActivityIndicator size="large" color={COLORS.black} />
            <Text style={styles.tripsLoadingText}>Carregando viagens...</Text>
          </View>
        )}
        {!tripsLoading && tripsError != null && (
          <Text style={styles.tripsErrorText}>{tripsError}</Text>
        )}
        {!tripsLoading && !tripsError && scheduledTrips.length === 0 && (
          <Text style={styles.tripsEmptyText}>
            {!hasDestination ? 'Defina origem e destino para ver viagens disponíveis.' : 'Nenhuma viagem encontrada para esta rota e horário.'}
          </Text>
        )}
        {!tripsLoading && scheduledTrips.map((trip) => (
          <TouchableOpacity
            key={trip.id}
            style={[styles.tripCard, selectedTripId === trip.id && styles.tripCardSelected]}
            onPress={() => setSelectedTripId(trip.id)}
            activeOpacity={0.8}
          >
            <View style={styles.tripCardTopRow}>
              {trip.driverAvatarUrl ? (
                <Image source={{ uri: trip.driverAvatarUrl }} style={styles.tripCardAvatar} />
              ) : (
                <View style={[styles.tripCardAvatar, styles.tripCardAvatarFallback]}>
                  <Text style={styles.tripCardAvatarInitials}>{getInitials(trip.driverName)}</Text>
                </View>
              )}
              <View style={styles.tripCardDriverWrap}>
                <Text style={styles.tripCardDriverName}>{trip.driverName}</Text>
                <Text style={styles.tripCardRating}>★ {formatDriverRatingLabel(trip.rating)}</Text>
              </View>
              <View style={[styles.tripCardBadge, styles.tripCardBadgeBg]}>
                <Text style={[styles.tripCardBadgeText, trip.badge === 'Take Me' ? styles.tripCardBadgeTakeMe : styles.tripCardBadgeParceiro]}>{trip.badge}</Text>
              </View>
            </View>
            <View style={styles.tripCardDivider} />
            <View style={styles.tripCardTimes}>
              <View style={styles.tripCardTimeRow}>
                <Text style={styles.tripCardTimeLabel}>Saída</Text>
                <Text style={styles.tripCardTimeValue}>{trip.departure}</Text>
              </View>
              <View style={styles.tripCardTimeRow}>
                <Text style={styles.tripCardTimeLabel}>Chegada</Text>
                <Text style={styles.tripCardTimeValue}>{trip.arrival}</Text>
              </View>
            </View>
            <View style={styles.tripCardDivider} />
            <View style={styles.tripCardCapacity}>
              <View style={styles.tripCardCapacityItem}>
                <MaterialIcons name="people" size={18} color={COLORS.neutral700} />
                <Text style={styles.tripCardCapacityText}>{trip.seats} lugares</Text>
              </View>
              <View style={styles.tripCardCapacityItem}>
                <MaterialIcons name="work-outline" size={18} color={COLORS.neutral700} />
                <Text style={styles.tripCardCapacityText}>{trip.bags} malas</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.agendarButton, (!selectedTripId || !hasDestination) && styles.agendarButtonDisabled]}
          onPress={handleAgendar}
          disabled={!selectedTripId || !hasDestination}
          activeOpacity={0.8}
        >
          <Text style={styles.agendarButtonText}>Agendar</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={editModalVisible} transparent animationType="none" onRequestClose={closeEditModal}>
        <KeyboardAvoidingView
          style={styles.editModalOverlayContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <Animated.View style={[styles.editModalOverlay, { opacity: editOverlayOpacity }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEditModal} />
          <Animated.View style={[styles.modalContent, { transform: [{ translateY: editSheetTranslateY }] }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Alterar endereços</Text>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalLabel}>Ponto de partida</Text>
              <AddressAutocomplete
                value={editOrigin}
                onChangeText={setEditOrigin}
                onSelectPlace={(place) => setOrigin({ address: place.address, latitude: place.latitude, longitude: place.longitude })}
                placeholder="Ex: Av. Presidente João Pessoa, 422"
                editable={!locationLoading}
                style={styles.modalAutocomplete}
              />
              <TouchableOpacity
                style={styles.useMyLocationButton}
                onPress={useMyLocationForOrigin}
                disabled={locationLoading}
                activeOpacity={0.8}
              >
                {locationLoading ? (
                  <ActivityIndicator size="small" color={COLORS.black} />
                ) : (
                  <MaterialIcons name="my-location" size={20} color={COLORS.black} />
                )}
                <Text style={styles.useMyLocationText}>Usar minha localização atual</Text>
              </TouchableOpacity>
              <Text style={styles.modalLabel}>Destino</Text>
              <AddressAutocomplete
                value={editDestination}
                onChangeText={setEditDestination}
                onSelectPlace={(place) => setDestination({ address: place.address, latitude: place.latitude, longitude: place.longitude })}
                placeholder="Ex: Rua Coronel José Gomes, 150"
                style={styles.modalAutocomplete}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalButtonSecondary} onPress={closeEditModal} activeOpacity={0.8}>
                  <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButtonPrimary} onPress={savePlaces} activeOpacity={0.8}>
                  <Text style={styles.modalButtonPrimaryText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={timeSheetVisible} transparent animationType="none" onRequestClose={closeTimeSheet} statusBarTranslucent>
        <View style={styles.timeSheetOverlayContainer} pointerEvents="box-none">
          <Animated.View style={[styles.timeSheetOverlay, { opacity: timeSheetOverlayOpacity }]} pointerEvents="none" />
          <Pressable style={styles.timeSheetOverlayTouchable} onPress={closeTimeSheet} />
          <Animated.View style={[styles.timeSheetContent, { transform: [{ translateY: timeSheetTranslateY }] }]} pointerEvents="box-none">
            <View style={styles.timeSheetHandle} />
            <Text style={styles.timeSheetTitle}>Escolha a hora</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.dateInputText}>{formatDateDisplayLabel(selectedDay)}</Text>
              <MaterialIcons name="event" size={22} color={COLORS.neutral700} />
            </TouchableOpacity>
            {showDatePicker && (
              <>
                <DateTimePicker
                  value={new Date(selectedDay + 'T12:00:00')}
                  mode="date"
                  display={Platform.OS === 'android' ? 'default' : 'spinner'}
                  minimumDate={new Date()}
                  onChange={(_, date) => {
                    if (date) {
                      setSelectedDay(toISODate(date));
                      setSelectedSlot(null);
                    }
                    if (Platform.OS === 'android') {
                      setShowDatePicker(false);
                    }
                  }}
                  locale="pt-BR"
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity style={styles.datePickerDoneButton} onPress={() => setShowDatePicker(false)} activeOpacity={0.8}>
                    <Text style={styles.datePickerDoneText}>Concluído</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            <ScrollView style={styles.timeSlotsScroll} contentContainerStyle={styles.timeSlotsContent}>
              {getAvailableTimeSlots(selectedDay, ALL_TIME_SLOTS).map((slot) => (
                <TouchableOpacity
                  key={slot.label}
                  style={styles.timeSlotRow}
                  onPress={() => setSelectedSlot(slot.label)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.timeSlotText}>{slot.label}</Text>
                  <View style={[styles.timeRadio, selectedSlot === slot.label && styles.timeRadioSelected]}>
                    {selectedSlot === slot.label && <View style={styles.timeRadioInner} />}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.timeSheetFooter}>
              <TouchableOpacity
                style={[styles.timePrimaryButton, !selectedSlot && styles.timePrimaryButtonDisabled]}
                onPress={handleSelectTime}
                disabled={!selectedSlot}
                activeOpacity={0.8}
              >
                <Text style={styles.timePrimaryButtonText}>Selecionar horário</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.timeCancelButton} onPress={closeTimeSheet}>
                <Text style={styles.timeCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 22, color: COLORS.black, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.black, flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 32 },
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
  routeIconsColumn: { alignItems: 'center', marginRight: 12 },
  routeIconOrigin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.neutral700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeIconOriginDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.neutral700,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: COLORS.neutral400,
    marginVertical: 4,
  },
  routeIconDestination: {
    width: 10,
    height: 10,
    backgroundColor: COLORS.neutral700,
  },
  routeAddresses: { flex: 1 },
  routeAddress: { fontSize: 14, fontWeight: '500', color: COLORS.black },
  routeAddressPlaceholder: { color: COLORS.neutral700 },
  routeAddressDivider: {
    height: 1,
    backgroundColor: COLORS.neutral400,
    marginVertical: 10,
  },
  editIcon: { padding: 4, marginLeft: 4, marginTop: 2 },
  editModalOverlayContainer: { flex: 1, justifyContent: 'flex-end' },
  editModalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '85%',
    minHeight: 420,
  },
  modalScroll: { flex: 1, minHeight: 0 },
  modalScrollContent: { paddingBottom: 24 },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.neutral400,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.black, marginBottom: 20 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: COLORS.black, marginBottom: 8 },
  modalAutocomplete: { marginBottom: 12 },
  useMyLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
  },
  useMyLocationText: { fontSize: 14, fontWeight: '600', color: COLORS.black },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalButtonSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.black,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonSecondaryText: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: COLORS.black,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonPrimaryText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  timeSheetOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  timeSheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  timeSheetOverlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  timeSheetContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  timeSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.neutral400,
    alignSelf: 'center',
    marginBottom: 24,
  },
  timeSheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.black,
    textAlign: 'center',
    marginBottom: 20,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  dateInputText: { fontSize: 16, color: COLORS.black, fontWeight: '500' },
  datePickerDoneButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: COLORS.black,
    borderRadius: 10,
  },
  datePickerDoneText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  timeDayScroll: { marginBottom: 24, maxHeight: 64 },
  timeDayTab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    alignItems: 'center',
    minWidth: 72,
  },
  timeDayTabSelected: { borderColor: COLORS.black, backgroundColor: COLORS.neutral300 },
  timeDayTabLabelTop: { fontSize: 14, fontWeight: '600', color: COLORS.neutral700 },
  timeDayTabLabelBottom: { fontSize: 12, fontWeight: '500', color: COLORS.neutral700, marginTop: 2 },
  timeDayTabTextSelected: { color: COLORS.black },
  timeSlotsScroll: { maxHeight: 240 },
  timeSlotsContent: { paddingBottom: 24 },
  timeSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral300,
  },
  timeSlotText: { fontSize: 16, fontWeight: '500', color: COLORS.black },
  timeRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.neutral400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRadioSelected: { borderColor: COLORS.black },
  timeRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.black,
  },
  timeSheetFooter: { paddingTop: 16 },
  timePrimaryButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  timePrimaryButtonDisabled: { opacity: 0.5 },
  timePrimaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  timeCancelButton: { paddingVertical: 12, alignItems: 'center' },
  timeCancelButtonText: { fontSize: 16, fontWeight: '500', color: COLORS.neutral700 },
  tripCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tripCardSelected: {
    borderColor: COLORS.black,
  },
  tripsLoadingWrap: { paddingVertical: 32, alignItems: 'center', gap: 12 },
  tripsLoadingText: { fontSize: 14, color: COLORS.neutral700 },
  tripsErrorText: { fontSize: 14, color: '#dc2626', marginBottom: 16 },
  tripsEmptyText: { fontSize: 14, color: COLORS.neutral700, marginBottom: 16 },
  tripCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripCardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FBBF24',
    marginRight: 12,
    overflow: 'hidden',
  },
  tripCardAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripCardAvatarInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
  },
  tripCardDriverWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  tripCardDriverName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
  },
  tripCardRating: {
    fontSize: 14,
    color: '#CBA04B',
    marginTop: 2,
  },
  tripCardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tripCardBadgeBg: {
    backgroundColor: '#FFFFFF',
  },
  tripCardBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tripCardBadgeTakeMe: {
    color: '#A37E38',
  },
  tripCardBadgeParceiro: {
    color: '#0D0D0D',
  },
  tripCardDivider: {
    height: 1,
    backgroundColor: COLORS.neutral400,
    marginVertical: 12,
  },
  tripCardTimes: {
    gap: 6,
  },
  tripCardTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripCardTimeLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.neutral700,
  },
  tripCardTimeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.black,
  },
  tripCardCapacity: {
    flexDirection: 'row',
    paddingTop: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  tripCardCapacityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripCardCapacityText: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.neutral700,
  },
  agendarButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  agendarButtonDisabled: { opacity: 0.5 },
  agendarButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
