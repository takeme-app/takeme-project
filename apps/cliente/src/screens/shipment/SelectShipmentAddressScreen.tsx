import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Text } from '../../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ShipmentStackParamList } from '../../navigation/types';
import {
  getRecentDestinations,
  addRecentDestination,
  formatRecentDestinationDisplay,
  type RecentDestination,
} from '../../lib/recentDestinations';
import { getCurrentPlace } from '../../lib/location';
import { useAppAlert } from '../../contexts/AppAlertContext';
import { useCurrentLocation } from '../../contexts/CurrentLocationContext';
import {
  getDateCarouselOptions,
  ALL_TIME_SLOTS,
  getAvailableTimeSlots,
  toISODate,
} from '../../lib/dateTimeSlots';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';

type Props = NativeStackScreenProps<ShipmentStackParamList, 'SelectShipmentAddress'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

const RECENT_LIST_SIZE = 10;
const DEFAULT_COORDS = { latitude: -7.3289, longitude: -35.3328 };
const DEFAULT_DESTINATION_COORDS = { latitude: -7.3305, longitude: -35.3335 };
const WHEN_SHEET_SLIDE = 400;
const TIME_SHEET_SLIDE = 450;
const SIZE_SHEET_SLIDE = 400;
const EDIT_SHEET_SLIDE = 400;

const PACKAGE_SIZE_OPTIONS: { value: 'pequeno' | 'medio' | 'grande'; label: string; subtitle: string }[] = [
  { value: 'pequeno', label: 'Pequeno', subtitle: 'Cabe em uma mochila' },
  { value: 'medio', label: 'Médio', subtitle: 'Cabe em uma mala de mão' },
  { value: 'grande', label: 'Grande', subtitle: 'Precisa de avaliação do nosso time' },
];

function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number | undefined,
  lng2: number | undefined
): number | null {
  if (lat2 == null || lng2 == null) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistanceKm(km: number): string {
  if (km < 1) return `${(km * 1000).toFixed(0)} m`;
  return `${km.toFixed(1)} km`;
}

export function SelectShipmentAddressScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();
  const { currentPlace, refreshLocation } = useCurrentLocation();
  const [originAddress, setOriginAddress] = useState('Obtendo sua localização...');
  const [originLat, setOriginLat] = useState(DEFAULT_COORDS.latitude);
  const [originLng, setOriginLng] = useState(DEFAULT_COORDS.longitude);
  const [recentDestinations, setRecentDestinations] = useState<RecentDestination[]>([]);
  const [whenSheetVisible, setWhenSheetVisible] = useState(false);
  const [whenOption, setWhenOption] = useState<'now' | 'later' | null>(null);
  const [whenLabel, setWhenLabel] = useState<string>('Agora');
  const whenOverlayOpacity = useRef(new Animated.Value(0)).current;
  const whenSheetTranslateY = useRef(new Animated.Value(WHEN_SHEET_SLIDE)).current;
  const [timeSheetVisible, setTimeSheetVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>(() => toISODate(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const timeSheetOverlayOpacity = useRef(new Animated.Value(0)).current;
  const timeSheetTranslateY = useRef(new Animated.Value(TIME_SHEET_SLIDE)).current;
  const [packageSize, setPackageSize] = useState<'pequeno' | 'medio' | 'grande'>('medio');
  const [packageSizeLabel, setPackageSizeLabel] = useState('Médio');
  const [sizeSheetVisible, setSizeSheetVisible] = useState(false);
  const sizeSheetOverlayOpacity = useRef(new Animated.Value(0)).current;
  const sizeSheetTranslateY = useRef(new Animated.Value(SIZE_SHEET_SLIDE)).current;
  const [destinationAddress, setDestinationAddress] = useState<string | null>(null);
  const [destinationLat, setDestinationLat] = useState(DEFAULT_DESTINATION_COORDS.latitude);
  const [destinationLng, setDestinationLng] = useState(DEFAULT_DESTINATION_COORDS.longitude);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editOrigin, setEditOrigin] = useState(originAddress);
  const [editDestination, setEditDestination] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const editOverlayOpacity = useRef(new Animated.Value(0)).current;
  const editSheetTranslateY = useRef(new Animated.Value(EDIT_SHEET_SLIDE)).current;

  const loadOrigin = useCallback(async () => {
    const place = await getCurrentPlace();
    if (place) {
      setOriginAddress(place.address);
      setOriginLat(place.latitude);
      setOriginLng(place.longitude);
    } else {
      setOriginAddress('Permita acesso à localização');
    }
  }, []);

  const loadRecentDestinations = useCallback(() => {
    getRecentDestinations().then(setRecentDestinations);
  }, []);

  useEffect(() => {
    if (currentPlace) {
      setOriginAddress(currentPlace.address);
      setOriginLat(currentPlace.latitude);
      setOriginLng(currentPlace.longitude);
    } else {
      loadOrigin();
    }
  }, [currentPlace?.latitude, currentPlace?.longitude, currentPlace?.address, loadOrigin]);

  useEffect(() => {
    loadRecentDestinations();
  }, [loadRecentDestinations]);

  useEffect(() => {
    setEditOrigin(originAddress);
    setEditDestination(destinationAddress ?? '');
  }, [originAddress, destinationAddress]);

  useEffect(() => {
    if (!editModalVisible) return;
    editOverlayOpacity.setValue(0);
    editSheetTranslateY.setValue(EDIT_SHEET_SLIDE);
    Animated.sequence([
      Animated.timing(editOverlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(editSheetTranslateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [editModalVisible]);

  const openEditModal = useCallback(() => {
    setEditOrigin(originAddress);
    setEditDestination(destinationAddress ?? '');
    editOverlayOpacity.setValue(0);
    editSheetTranslateY.setValue(EDIT_SHEET_SLIDE);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setEditModalVisible(true));
    });
  }, [originAddress, destinationAddress]);

  const closeEditModal = useCallback(() => setEditModalVisible(false), []);

  const useMyLocationForOrigin = useCallback(async () => {
    setLocationLoading(true);
    try {
      const place = await refreshLocation();
      if (place) {
        setOriginAddress(place.address);
        setOriginLat(place.latitude);
        setOriginLng(place.longitude);
        setEditOrigin(place.address);
      } else {
        showAlert(
          'Localização',
          'Não foi possível usar sua localização. Verifique se o app tem permissão nas configurações.'
        );
      }
    } catch {
      showAlert('Localização', 'Não foi possível obter seu endereço. Tente novamente.');
    } finally {
      setLocationLoading(false);
    }
  }, [refreshLocation, showAlert]);

  const goToRecipient = useCallback(
    (origin: { address: string; latitude: number; longitude: number }, destination: { address: string; latitude: number; longitude: number }) => {
      navigation.navigate('Recipient', {
        origin,
        destination,
        whenOption: whenOption ?? 'now',
        whenLabel: whenOption === 'later' ? whenLabel : 'Agora',
        packageSize,
        packageSizeLabel,
      });
    },
    [navigation, whenOption, whenLabel, packageSize, packageSizeLabel]
  );

  const savePlaces = useCallback(() => {
    const newOriginAddress = editOrigin.trim() || originAddress;
    setOriginAddress(newOriginAddress);
    const destText = editDestination.trim();
    if (destText) {
      setDestinationAddress(destText);
      const city = destText.includes(', ') ? destText.split(', ').slice(-1)[0] ?? destText : destText;
      addRecentDestination({
        address: destText,
        city,
        latitude: destinationLat,
        longitude: destinationLng,
      }).then(loadRecentDestinations);
      closeEditModal();
      goToRecipient(
        { address: newOriginAddress, latitude: originLat, longitude: originLng },
        { address: destText, latitude: destinationLat, longitude: destinationLng }
      );
    } else {
      setDestinationAddress(null);
      closeEditModal();
    }
  }, [
    editOrigin,
    editDestination,
    originAddress,
    originLat,
    originLng,
    destinationLat,
    destinationLng,
    closeEditModal,
    loadRecentDestinations,
    goToRecipient,
  ]);

  useEffect(() => {
    if (!whenSheetVisible) return;
    setWhenOption(null);
    whenOverlayOpacity.setValue(0);
    whenSheetTranslateY.setValue(WHEN_SHEET_SLIDE);
    Animated.sequence([
      Animated.timing(whenOverlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(whenSheetTranslateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [whenSheetVisible]);

  const openWhenSheet = useCallback(() => {
    setWhenOption(null);
    whenOverlayOpacity.setValue(0);
    whenSheetTranslateY.setValue(WHEN_SHEET_SLIDE);
    setWhenSheetVisible(true);
  }, []);

  const closeWhenSheet = useCallback(() => {
    whenOverlayOpacity.setValue(0);
    whenSheetTranslateY.setValue(WHEN_SHEET_SLIDE);
    setWhenSheetVisible(false);
    setWhenOption(null);
  }, []);

  const openTimeSheet = useCallback(() => {
    setSelectedDay(toISODate(new Date()));
    setSelectedSlot(null);
    timeSheetOverlayOpacity.setValue(0);
    timeSheetTranslateY.setValue(TIME_SHEET_SLIDE);
    setTimeSheetVisible(true);
  }, []);

  const closeTimeSheet = useCallback(() => {
    timeSheetOverlayOpacity.setValue(0);
    timeSheetTranslateY.setValue(TIME_SHEET_SLIDE);
    setTimeSheetVisible(false);
    setSelectedSlot(null);
  }, []);

  const handleWhenContinue = useCallback(() => {
    if (whenOption === 'now') {
      setWhenLabel('Agora');
      setWhenSheetVisible(false);
      whenOverlayOpacity.setValue(0);
      whenSheetTranslateY.setValue(WHEN_SHEET_SLIDE);
    } else if (whenOption === 'later') {
      setWhenSheetVisible(false);
      whenOverlayOpacity.setValue(0);
      whenSheetTranslateY.setValue(WHEN_SHEET_SLIDE);
      openTimeSheet();
    }
  }, [whenOption, openTimeSheet]);

  const handleSelectTime = useCallback(() => {
    if (selectedSlot) {
      const dayOpt = getDateCarouselOptions().find((o) => o.id === selectedDay);
      const slotStart = selectedSlot.split(' ')[0] ?? selectedSlot;
      setWhenLabel(`${dayOpt?.dayLabel ?? 'Hoje'}, ${slotStart}`);
      setWhenOption('later');
      closeTimeSheet();
    }
  }, [selectedSlot, selectedDay, closeTimeSheet]);

  useEffect(() => {
    if (!timeSheetVisible) return;
    timeSheetOverlayOpacity.setValue(0);
    timeSheetTranslateY.setValue(TIME_SHEET_SLIDE);
    Animated.sequence([
      Animated.timing(timeSheetOverlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(timeSheetTranslateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [timeSheetVisible]);

  const openSizeSheet = useCallback(() => {
    sizeSheetOverlayOpacity.setValue(0);
    sizeSheetTranslateY.setValue(SIZE_SHEET_SLIDE);
    setSizeSheetVisible(true);
  }, []);

  useEffect(() => {
    if (!sizeSheetVisible) return;
    sizeSheetOverlayOpacity.setValue(0);
    sizeSheetTranslateY.setValue(SIZE_SHEET_SLIDE);
    Animated.sequence([
      Animated.timing(sizeSheetOverlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(sizeSheetTranslateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [sizeSheetVisible]);

  const closeSizeSheet = useCallback(() => {
    sizeSheetOverlayOpacity.setValue(0);
    sizeSheetTranslateY.setValue(SIZE_SHEET_SLIDE);
    setSizeSheetVisible(false);
  }, []);

  const selectPackageSize = useCallback((value: 'pequeno' | 'medio' | 'grande', label: string) => {
    setPackageSize(value);
    setPackageSizeLabel(label);
    closeSizeSheet();
  }, [closeSizeSheet]);

  const sortedRecentDestinations = useMemo(() => {
    return [...recentDestinations]
      .map((item) => ({
        item,
        distKm: distanceKm(originLat, originLng, item.latitude, item.longitude),
      }))
      .sort((a, b) => {
        const da = a.distKm ?? Infinity;
        const db = b.distKm ?? Infinity;
        return da - db;
      })
      .map(({ item }) => item)
      .slice(0, RECENT_LIST_SIZE);
  }, [recentDestinations, originLat, originLng]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <StatusBar style="dark" />

      <View style={styles.planPageHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Para onde?</Text>
      </View>

      <View style={styles.pillsRow}>
        <TouchableOpacity style={styles.pillWrap} onPress={openWhenSheet} activeOpacity={0.8}>
          <View style={styles.pill}>
            <MaterialIcons name="schedule" size={20} color={COLORS.black} />
            <Text style={styles.pillText}>{whenOption === 'later' ? whenLabel : 'Agora'}</Text>
            <MaterialIcons name="keyboard-arrow-down" size={20} color={COLORS.black} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pillWrap} onPress={openSizeSheet} activeOpacity={0.8}>
          <View style={styles.pill}>
            <MaterialIcons name="shopping-bag" size={20} color={COLORS.black} />
            <Text style={styles.pillText}>{packageSizeLabel}</Text>
            <MaterialIcons name="keyboard-arrow-down" size={20} color={COLORS.black} />
          </View>
        </TouchableOpacity>
      </View>

      <Modal visible={whenSheetVisible} transparent animationType="none" onRequestClose={closeWhenSheet} statusBarTranslucent>
        <View style={styles.sheetOverlayContainer} pointerEvents="box-none">
          <Animated.View style={[styles.sheetOverlay, { opacity: whenOverlayOpacity }]} pointerEvents="none" />
          <Pressable style={styles.sheetOverlayTouchable} onPress={closeWhenSheet} />
          <Animated.View style={[styles.sheetContent, { transform: [{ translateY: whenSheetTranslateY }] }]} pointerEvents="box-none">
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Para quando você precisa do envio?</Text>
            <TouchableOpacity
              style={[styles.sheetOption, whenOption === 'now' && styles.sheetOptionSelected]}
              onPress={() => setWhenOption('now')}
              activeOpacity={0.8}
            >
              <View style={styles.sheetOptionIcon}>
                <MaterialIcons name="schedule" size={28} color={COLORS.black} />
              </View>
              <View style={styles.sheetOptionTextWrap}>
                <Text style={styles.sheetOptionLabel}>Agora</Text>
                <Text style={styles.sheetOptionSubtitle}>Envio imediato</Text>
              </View>
              <View style={[styles.sheetRadio, whenOption === 'now' && styles.sheetRadioSelected]}>
                {whenOption === 'now' && <View style={styles.sheetRadioInner} />}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetOption, whenOption === 'later' && styles.sheetOptionSelected]}
              onPress={() => setWhenOption('later')}
              activeOpacity={0.8}
            >
              <View style={styles.sheetOptionIcon}>
                <MaterialIcons name="event" size={28} color={COLORS.black} />
              </View>
              <View style={styles.sheetOptionTextWrap}>
                <Text style={styles.sheetOptionLabel}>Mais tarde</Text>
                <Text style={styles.sheetOptionSubtitle}>Agende para o horário que preferir</Text>
              </View>
              <View style={[styles.sheetRadio, whenOption === 'later' && styles.sheetRadioSelected]}>
                {whenOption === 'later' && <View style={styles.sheetRadioInner} />}
              </View>
            </TouchableOpacity>
            {whenOption === 'later' && (
              <Text style={styles.sheetAvailabilityHint}>
                A disponibilidade depende das rotas dos motoristas na data escolhida. Se não houver viagens nesse dia, você poderá reagendar.
              </Text>
            )}
            <TouchableOpacity
              style={[styles.sheetContinueButton, !whenOption && styles.sheetContinueButtonDisabled]}
              onPress={handleWhenContinue}
              disabled={!whenOption}
              activeOpacity={0.8}
            >
              <Text style={styles.sheetContinueButtonText}>Continuar</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={timeSheetVisible} transparent animationType="none" onRequestClose={closeTimeSheet} statusBarTranslucent>
        <View style={styles.sheetOverlayContainer} pointerEvents="box-none">
          <Animated.View style={[styles.sheetOverlay, { opacity: timeSheetOverlayOpacity }]} pointerEvents="none" />
          <Pressable style={styles.sheetOverlayTouchable} onPress={closeTimeSheet} />
          <Animated.View style={[styles.sheetContent, { transform: [{ translateY: timeSheetTranslateY }] }]} pointerEvents="box-none">
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Escolha a hora</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeDayScroll}>
              {getDateCarouselOptions().map((day) => (
                <TouchableOpacity
                  key={day.id}
                  style={[styles.timeDayTab, selectedDay === day.id && styles.timeDayTabSelected]}
                  onPress={() => {
                    setSelectedDay(day.id);
                    setSelectedSlot(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.timeDayTabLabelTop, selectedDay === day.id && styles.timeDayTabTextSelected]}>
                    {day.dayLabel}
                  </Text>
                  <Text style={[styles.timeDayTabLabelBottom, selectedDay === day.id && styles.timeDayTabTextSelected]}>
                    {day.dateLabel}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
            <View style={styles.sheetFooter}>
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

      <Modal visible={sizeSheetVisible} transparent animationType="none" onRequestClose={closeSizeSheet} statusBarTranslucent>
        <View style={styles.sheetOverlayContainer} pointerEvents="box-none">
          <Animated.View style={[styles.sheetOverlay, { opacity: sizeSheetOverlayOpacity }]} pointerEvents="none" />
          <Pressable style={styles.sheetOverlayTouchable} onPress={closeSizeSheet} />
          <Animated.View style={[styles.sheetContent, { transform: [{ translateY: sizeSheetTranslateY }] }]} pointerEvents="box-none">
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Selecione o tamanho da encomenda</Text>
            {PACKAGE_SIZE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.sheetOption, packageSize === opt.value && styles.sheetOptionSelected]}
                onPress={() => selectPackageSize(opt.value, opt.label)}
                activeOpacity={0.8}
              >
                <View style={styles.sheetOptionTextWrap}>
                  <Text style={styles.sheetOptionLabel}>{opt.label}</Text>
                  <Text style={styles.sheetOptionSubtitle}>{opt.subtitle}</Text>
                </View>
                <View style={[styles.sheetRadio, packageSize === opt.value && styles.sheetRadioSelected]}>
                  {packageSize === opt.value && <View style={styles.sheetRadioInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </View>
      </Modal>

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
                onSelectPlace={(place) => {
                  setOriginAddress(place.address);
                  setOriginLat(place.latitude);
                  setOriginLng(place.longitude);
                  setEditOrigin(place.address);
                }}
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
                onSelectPlace={(place) => {
                  setDestinationAddress(place.address);
                  setDestinationLat(place.latitude);
                  setDestinationLng(place.longitude);
                  setEditDestination(place.address);
                }}
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

      <TouchableOpacity style={styles.routeCard} onPress={openEditModal} activeOpacity={0.8}>
        <View style={styles.routeIconsColumn}>
          <View style={styles.routeIconOrigin}>
            <View style={styles.routeIconOriginDot} />
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeIconDestination} />
        </View>
        <View style={styles.routeAddresses}>
          <Text style={styles.routeAddress} numberOfLines={1}>
            {originAddress}
          </Text>
          <View style={styles.routeAddressDivider} />
          <Text style={[styles.routeAddress, !destinationAddress && styles.routeAddressPlaceholder]} numberOfLines={1}>
            {destinationAddress ?? 'Para onde?'}
          </Text>
        </View>
        <MaterialIcons name="edit" size={20} color={COLORS.neutral700} style={styles.editIcon} />
      </TouchableOpacity>

      <ScrollView
        style={styles.planPageScroll}
        contentContainerStyle={styles.planPageScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {sortedRecentDestinations.map((item, index) => {
          const distKm = distanceKm(originLat, originLng, item.latitude, item.longitude);
          const distanceLabel = distKm != null ? formatDistanceKm(distKm) : null;
          const lat = item.latitude ?? DEFAULT_COORDS.latitude;
          const lng = item.longitude ?? DEFAULT_COORDS.longitude;
          const { line1, line2 } = formatRecentDestinationDisplay(item);
          return (
            <TouchableOpacity
              key={index}
              style={styles.recentListPageRow}
              activeOpacity={0.7}
              onPress={() => {
                goToRecipient(
                  { address: originAddress, latitude: originLat, longitude: originLng },
                  { address: item.address, latitude: lat, longitude: lng }
                );
              }}
            >
              <View style={styles.recentIconAndDistance}>
                <View style={styles.recentIconWrap}>
                  <MaterialIcons name="access-time" size={24} color={COLORS.black} />
                </View>
                {distanceLabel != null && (
                  <Text style={styles.recentDistance} numberOfLines={1}>
                    {distanceLabel}
                  </Text>
                )}
              </View>
              <View style={styles.recentTextWrap}>
                <Text style={styles.recentAddress} numberOfLines={1}>
                  {line1}
                </Text>
                <Text style={styles.recentCity} numberOfLines={1}>
                  {line2}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 24 },
  planPageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backArrow: { fontSize: 22, color: COLORS.black, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.black, flex: 1 },
  pillsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  pillWrap: { flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.neutral300,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    gap: 8,
  },
  pillText: { fontSize: 15, fontWeight: '600', color: COLORS.black },
  sheetOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  sheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetOverlayTouchable: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheetContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 34,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.neutral400,
    alignSelf: 'center',
    marginBottom: 24,
  },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: COLORS.black, marginBottom: 24 },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sheetOptionSelected: { borderColor: COLORS.black },
  sheetOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  sheetOptionTextWrap: { flex: 1 },
  sheetOptionLabel: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  sheetOptionSubtitle: { fontSize: 14, color: COLORS.neutral700, marginTop: 2 },
  sheetRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.neutral400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRadioSelected: { borderColor: COLORS.black },
  sheetRadioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.black },
  sheetAvailabilityHint: {
    fontSize: 13,
    color: COLORS.neutral700,
    lineHeight: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  sheetContinueButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  sheetContinueButtonDisabled: { opacity: 0.5 },
  sheetContinueButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  sheetFooter: { paddingTop: 16 },
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
  timeRadioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.black },
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
  routeIconOriginDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.neutral700 },
  routeLine: { width: 2, height: 24, backgroundColor: COLORS.neutral400, marginVertical: 4 },
  routeIconDestination: { width: 10, height: 10, backgroundColor: COLORS.neutral700 },
  routeAddresses: { flex: 1 },
  routeAddress: { fontSize: 14, fontWeight: '500', color: COLORS.black },
  routeAddressPlaceholder: { color: COLORS.neutral700 },
  routeAddressDivider: { height: 1, backgroundColor: COLORS.neutral400, marginVertical: 10 },
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
  planPageScroll: { flex: 1 },
  planPageScrollContent: { paddingBottom: 24 },
  recentListPageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral300,
  },
  recentIconAndDistance: { alignItems: 'center', minWidth: 48 },
  recentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentDistance: { fontSize: 12, color: COLORS.neutral700, marginTop: 4 },
  recentTextWrap: { flex: 1, gap: 2 },
  recentAddress: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  recentCity: { fontSize: 14, fontWeight: '400', color: COLORS.neutral700 },
});
