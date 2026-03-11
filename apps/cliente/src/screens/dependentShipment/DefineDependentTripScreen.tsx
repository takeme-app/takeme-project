import { useState, useCallback, useEffect, useRef } from 'react';
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text } from '../../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DependentShipmentStackParamList } from '../../navigation/types';
import type { ShipmentPlaceParam } from '../../navigation/types';
import { MaterialIcons } from '@expo/vector-icons';
import { getCurrentPlace } from '../../lib/location';
import { useAppAlert } from '../../contexts/AppAlertContext';
import { useCurrentLocation } from '../../contexts/CurrentLocationContext';
import {
  ALL_TIME_SLOTS,
  getAvailableTimeSlots,
  toISODate,
  formatDateDisplayLabel,
} from '../../lib/dateTimeSlots';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';

type Props = NativeStackScreenProps<DependentShipmentStackParamList, 'DefineDependentTrip'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};
const DEFAULT_COORDS = { latitude: -7.3289, longitude: -35.3328 };
const DEFAULT_DEST_COORDS = { latitude: -7.3305, longitude: -35.3335 };
const WHEN_SHEET_SLIDE = 400;
const TIME_SHEET_SLIDE = 450;

/** Valor placeholder em centavos para envio de dependente (ex.: R$ 50,00). */
const PLACEHOLDER_AMOUNT_CENTS = 5000;

export function DefineDependentTripScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();
  const { currentPlace, refreshLocation } = useCurrentLocation();
  const { fullName, contactPhone, bagsCount, instructions, dependentId } = route.params;

  const [originAddress, setOriginAddress] = useState('Obtendo sua localização...');
  const [originLat, setOriginLat] = useState(DEFAULT_COORDS.latitude);
  const [originLng, setOriginLng] = useState(DEFAULT_COORDS.longitude);
  const [destinationAddress, setDestinationAddress] = useState('');
  const [destinationLat, setDestinationLat] = useState(DEFAULT_DEST_COORDS.latitude);
  const [destinationLng, setDestinationLng] = useState(DEFAULT_DEST_COORDS.longitude);
  const [destinationConfirmed, setDestinationConfirmed] = useState(false);
  const [whenOption, setWhenOption] = useState<'now' | 'later'>('now');
  const [whenLabel, setWhenLabel] = useState('Agora');
  const [whenSheetVisible, setWhenSheetVisible] = useState(false);
  const [timeSheetVisible, setTimeSheetVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState(() => toISODate(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const whenOverlayOpacity = useRef(new Animated.Value(0)).current;
  const whenSheetTranslateY = useRef(new Animated.Value(WHEN_SHEET_SLIDE)).current;
  const timeSheetOverlayOpacity = useRef(new Animated.Value(0)).current;
  const timeSheetTranslateY = useRef(new Animated.Value(TIME_SHEET_SLIDE)).current;

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

  useEffect(() => {
    if (currentPlace) {
      setOriginAddress(currentPlace.address);
      setOriginLat(currentPlace.latitude);
      setOriginLng(currentPlace.longitude);
    } else {
      loadOrigin();
    }
  }, [currentPlace?.latitude, currentPlace?.longitude, currentPlace?.address, loadOrigin]);

  const useMyLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const place = await refreshLocation();
      if (place) {
        setOriginAddress(place.address);
        setOriginLat(place.latitude);
        setOriginLng(place.longitude);
      } else {
        showAlert('Localização', 'Não foi possível usar sua localização.');
      }
    } catch {
      showAlert('Localização', 'Não foi possível obter seu endereço.');
    } finally {
      setLocationLoading(false);
    }
  }, [refreshLocation, showAlert]);

  useEffect(() => {
    if (!whenSheetVisible) return;
    whenOverlayOpacity.setValue(0);
    whenSheetTranslateY.setValue(WHEN_SHEET_SLIDE);
    Animated.sequence([
      Animated.timing(whenOverlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(whenSheetTranslateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [whenSheetVisible]);

  const openWhenSheet = useCallback(() => setWhenSheetVisible(true), []);
  const closeWhenSheet = useCallback(() => setWhenSheetVisible(false), []);

  const handleWhenContinue = useCallback(() => {
    if (whenOption === 'now') {
      setWhenLabel('Agora');
      setWhenSheetVisible(false);
    } else {
      setWhenSheetVisible(false);
      setSelectedDay(toISODate(new Date()));
      setSelectedSlot(null);
      timeSheetOverlayOpacity.setValue(0);
      timeSheetTranslateY.setValue(TIME_SHEET_SLIDE);
      setTimeSheetVisible(true);
    }
  }, [whenOption]);

  useEffect(() => {
    if (!timeSheetVisible) return;
    timeSheetOverlayOpacity.setValue(0);
    timeSheetTranslateY.setValue(TIME_SHEET_SLIDE);
    Animated.sequence([
      Animated.timing(timeSheetOverlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(timeSheetTranslateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [timeSheetVisible]);

  const handleSelectTime = useCallback(() => {
    if (selectedSlot) {
      const slotStart = selectedSlot.split(' ')[0] ?? selectedSlot;
      setWhenLabel(`${formatDateDisplayLabel(selectedDay)}, ${slotStart}`);
      setWhenOption('later');
      setTimeSheetVisible(false);
    }
  }, [selectedSlot, selectedDay]);

  const goToConfirm = useCallback(() => {
    const dest = destinationAddress.trim();
    if (!dest) {
      showAlert('Atenção', 'Informe o destino da viagem.');
      return;
    }
    if (!destinationConfirmed) {
      showAlert('Atenção', 'Selecione o destino a partir das sugestões para garantir a localização correta.');
      return;
    }
    const origin: ShipmentPlaceParam = {
      address: originAddress,
      latitude: originLat,
      longitude: originLng,
    };
    const destination: ShipmentPlaceParam = {
      address: dest,
      latitude: destinationLat,
      longitude: destinationLng,
    };
    navigation.navigate('ConfirmDependentShipment', {
      origin,
      destination,
      whenOption,
      whenLabel: whenOption === 'later' ? whenLabel : undefined,
      fullName,
      contactPhone,
      bagsCount,
      instructions,
      dependentId,
      amountCents: PLACEHOLDER_AMOUNT_CENTS,
    });
  }, [
    destinationAddress,
    destinationConfirmed,
    destinationLat,
    destinationLng,
    originAddress,
    originLat,
    originLng,
    whenOption,
    whenLabel,
    fullName,
    contactPhone,
    bagsCount,
    instructions,
    dependentId,
    navigation,
    showAlert,
  ]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Definir viagem</Text>
      </View>

      <TouchableOpacity style={styles.whenPill} onPress={openWhenSheet} activeOpacity={0.8}>
        <MaterialIcons name="schedule" size={20} color={COLORS.black} />
        <Text style={styles.pillText}>{whenOption === 'later' ? whenLabel : 'Agora'}</Text>
        <MaterialIcons name="keyboard-arrow-down" size={20} color={COLORS.black} />
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>Ponto de partida</Text>
        <View style={styles.addressRow}>
          <Text style={styles.addressText} numberOfLines={1}>{originAddress}</Text>
          <TouchableOpacity
            style={styles.useLocationBtn}
            onPress={useMyLocation}
            disabled={locationLoading}
            activeOpacity={0.8}
          >
            {locationLoading ? (
              <ActivityIndicator size="small" color={COLORS.black} />
            ) : (
              <MaterialIcons name="my-location" size={20} color={COLORS.black} />
            )}
            <Text style={styles.useLocationText}>Minha localização</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.label}>Destino</Text>
        <AddressAutocomplete
          value={destinationAddress}
          onChangeText={(text) => {
            setDestinationAddress(text);
            setDestinationConfirmed(false);
          }}
          onSelectPlace={(place) => {
            setDestinationAddress(place.address);
            setDestinationLat(place.latitude);
            setDestinationLng(place.longitude);
            setDestinationConfirmed(true);
          }}
          placeholder="Ex: Rodoviária, hotel..."
          style={styles.autocomplete}
        />
        <TouchableOpacity style={styles.primaryButton} onPress={goToConfirm} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>Continuar</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={whenSheetVisible} transparent animationType="none" onRequestClose={closeWhenSheet} statusBarTranslucent>
        <View style={styles.sheetOverlayContainer}>
          <Animated.View style={[styles.sheetOverlay, { opacity: whenOverlayOpacity }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeWhenSheet} />
          <Animated.View style={[styles.sheetContent, { transform: [{ translateY: whenSheetTranslateY }] }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Para quando?</Text>
            <TouchableOpacity
              style={[styles.sheetOption, whenOption === 'now' && styles.sheetOptionSelected]}
              onPress={() => setWhenOption('now')}
              activeOpacity={0.8}
            >
              <Text style={styles.sheetOptionLabel}>Agora</Text>
              <View style={[styles.sheetRadio, whenOption === 'now' && styles.sheetRadioSelected]}>
                {whenOption === 'now' && <View style={styles.sheetRadioInner} />}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetOption, whenOption === 'later' && styles.sheetOptionSelected]}
              onPress={() => setWhenOption('later')}
              activeOpacity={0.8}
            >
              <Text style={styles.sheetOptionLabel}>Mais tarde</Text>
              <View style={[styles.sheetRadio, whenOption === 'later' && styles.sheetRadioSelected]}>
                {whenOption === 'later' && <View style={styles.sheetRadioInner} />}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetContinueButton} onPress={handleWhenContinue} activeOpacity={0.8}>
              <Text style={styles.sheetContinueButtonText}>Continuar</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={timeSheetVisible} transparent animationType="none" onRequestClose={() => setTimeSheetVisible(false)} statusBarTranslucent>
        <View style={styles.sheetOverlayContainer}>
          <Animated.View style={[styles.sheetOverlay, { opacity: timeSheetOverlayOpacity }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setTimeSheetVisible(false)} />
          <Animated.View style={[styles.sheetContent, { transform: [{ translateY: timeSheetTranslateY }] }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Escolha o horário</Text>
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
            <TouchableOpacity
              style={[styles.sheetContinueButton, !selectedSlot && styles.sheetContinueButtonDisabled]}
              onPress={handleSelectTime}
              disabled={!selectedSlot}
              activeOpacity={0.8}
            >
              <Text style={styles.sheetContinueButtonText}>Selecionar horário</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
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
  whenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.neutral300,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    gap: 8,
    marginBottom: 20,
  },
  pillText: { fontSize: 15, fontWeight: '600', color: COLORS.black },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  label: { fontSize: 15, fontWeight: '500', color: COLORS.black, marginBottom: 8 },
  addressRow: { marginBottom: 20 },
  addressText: { fontSize: 16, color: COLORS.black, marginBottom: 8 },
  useLocationBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  useLocationText: { fontSize: 14, color: COLORS.black, fontWeight: '500' },
  autocomplete: { marginBottom: 20 },
  primaryButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  sheetOverlayContainer: { flex: 1, justifyContent: 'flex-end' },
  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 32,
    minHeight: 280,
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '600', color: COLORS.black, marginBottom: 16 },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral300,
  },
  sheetOptionSelected: {},
  sheetRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.black, alignItems: 'center', justifyContent: 'center' },
  sheetRadioSelected: {},
  sheetRadioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.black },
  sheetContinueButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  sheetContinueButtonDisabled: { opacity: 0.5 },
  sheetContinueButtonText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
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
  timeDayScroll: { marginBottom: 16, maxHeight: 60 },
  timeDayTab: { paddingVertical: 8, paddingHorizontal: 16, marginRight: 8, borderRadius: 12, backgroundColor: COLORS.neutral300 },
  timeDayTabSelected: { backgroundColor: COLORS.black },
  timeDayTabLabel: { fontSize: 14, fontWeight: '600', color: COLORS.black },
  timeDayTabSublabel: { fontSize: 12, color: COLORS.neutral700 },
  timeDayTabLabelSelected: { color: '#FFF' },
  timeSlotsScroll: { maxHeight: 200 },
  timeSlotsContent: { paddingBottom: 16 },
  timeSlotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  timeSlotText: { fontSize: 15, color: COLORS.black },
  timeRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.black, alignItems: 'center', justifyContent: 'center' },
  timeRadioSelected: {},
  timeRadioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.black },
});
