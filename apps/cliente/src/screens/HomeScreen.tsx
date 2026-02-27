import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Modal, Pressable, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../navigation/MainTabs';
import { useRootNavigation } from '../navigation/RootNavigationContext';
import { getRecentDestinations, formatRecentDestinationDisplay, type RecentDestination } from '../lib/recentDestinations';
import { getDateCarouselOptions, ALL_TIME_SLOTS, getAvailableTimeSlots, toISODate } from '../lib/dateTimeSlots';

// Tokens do Figma: neutral-100 white, black-500 #0d0d0d, neutral-300 #f1f1f1, neutral-400 #e2e2e2, neutral-700 #767676
const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

const SERVICES = [
  { id: 'viagens', label: 'Viagens', image: require('../../assets/icon-viagens.png') },
  { id: 'envios', label: 'Envios', image: require('../../assets/icon-envios.png') },
  { id: 'dependentes', label: 'Envios de\ndependentes', image: require('../../assets/icon-excursoes.png') },
  { id: 'excursões', label: 'Excursões', image: require('../../assets/icon-dependentes.png') },
];

type HomeScreenProps = BottomTabScreenProps<MainTabParamList, 'Home'>;


const SHEET_SLIDE_DISTANCE = 400;
const TIME_SHEET_SLIDE = 450;

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { navigateToTripStack } = useRootNavigation();
  const [whenSheetVisible, setWhenSheetVisible] = useState(false);
  const [whenOption, setWhenOption] = useState<'now' | 'later' | null>(null);
  const [recentDestinations, setRecentDestinations] = useState<RecentDestination[]>([]);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_SLIDE_DISTANCE)).current;
  const [timeSheetVisible, setTimeSheetVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>(() => toISODate(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const timeSheetOverlayOpacity = useRef(new Animated.Value(0)).current;
  const timeSheetTranslateY = useRef(new Animated.Value(TIME_SHEET_SLIDE)).current;

  const loadRecentDestinations = useCallback(() => {
    getRecentDestinations().then(setRecentDestinations);
  }, []);

  useEffect(() => {
    loadRecentDestinations();
  }, [loadRecentDestinations]);

  useFocusEffect(loadRecentDestinations);

  useEffect(() => {
    if (!whenSheetVisible) return;
    overlayOpacity.setValue(0);
    sheetTranslateY.setValue(SHEET_SLIDE_DISTANCE);
    Animated.sequence([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [whenSheetVisible]);

  useEffect(() => {
    if (!timeSheetVisible) return;
    timeSheetOverlayOpacity.setValue(0);
    timeSheetTranslateY.setValue(TIME_SHEET_SLIDE);
    Animated.sequence([
      Animated.timing(timeSheetOverlayOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(timeSheetTranslateY, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [timeSheetVisible]);

  const openWhenSheet = () => {
    setWhenOption(null);
    overlayOpacity.setValue(0);
    sheetTranslateY.setValue(SHEET_SLIDE_DISTANCE);
    setWhenSheetVisible(true);
  };

  const closeWhenSheet = () => {
    overlayOpacity.setValue(0);
    sheetTranslateY.setValue(SHEET_SLIDE_DISTANCE);
    setWhenSheetVisible(false);
    setWhenOption(null);
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

  const handleWhenContinue = () => {
    if (whenOption === 'now') {
      closeWhenSheet();
      navigateToTripStack('SearchTrip', { immediateTrip: false });
    } else if (whenOption === 'later') {
      closeWhenSheet();
      openTimeSheet();
    }
  };

  const handleSelectTime = () => {
    if (selectedSlot) {
      closeTimeSheet();
      navigateToTripStack('PlanRide', { scheduledDateId: selectedDay, scheduledTimeSlot: selectedSlot });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Barra de busca */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <TouchableOpacity
              style={styles.searchTouchable}
              activeOpacity={0.7}
              onPress={() => navigateToTripStack('PlanTrip')}
            >
              <MaterialIcons name="search" size={24} color={COLORS.black} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Para onde?"
                placeholderTextColor={COLORS.neutral700}
                editable={false}
                pointerEvents="none"
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.agendarButton} activeOpacity={0.8} onPress={openWhenSheet}>
              <MaterialIcons name="event" size={24} color={COLORS.black} />
              <Text style={styles.agendarText}>Agendar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Destinos recentes (máx. 2) — só exibe quando houver histórico */}
        {recentDestinations.length > 0 && (
          <View style={styles.recentCard}>
            {recentDestinations.slice(0, 2).map((item, index) => {
              const { line1, line2 } = formatRecentDestinationDisplay(item);
              return (
              <TouchableOpacity
                key={index}
                style={styles.recentRow}
                activeOpacity={0.7}
                onPress={() => navigateToTripStack('SearchTrip', {
                  destination: {
                    address: item.address,
                    city: item.city,
                    latitude: item.latitude,
                    longitude: item.longitude,
                  },
                  immediateTrip: true,
                })}
              >
                <View style={styles.recentIconWrap}>
                  <MaterialIcons name="access-time" size={24} color={COLORS.black} />
                </View>
                <View style={styles.recentTextWrap}>
                  <Text style={styles.recentAddress} numberOfLines={1}>{line1}</Text>
                  <Text style={styles.recentCity} numberOfLines={1}>{line2}</Text>
                </View>
              </TouchableOpacity>
            );
            })}
          </View>
        )}

        {/* Serviços disponíveis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Serviços disponíveis</Text>
          <View style={styles.servicesGrid}>
            <View style={styles.servicesRow}>
              {SERVICES.slice(0, 2).map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={styles.serviceCard}
                  activeOpacity={0.8}
                  onPress={() => service.id === 'viagens' && navigateToTripStack('SearchTrip', { immediateTrip: false })}
                >
                  <View style={styles.serviceIconWrap}>
                    <Image source={service.image} style={styles.serviceImage} resizeMode="contain" />
                  </View>
                  <Text style={styles.serviceLabel}>{service.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.servicesRow}>
              {SERVICES.slice(2, 4).map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={styles.serviceCard}
                  activeOpacity={0.8}
                >
                  <View style={styles.serviceIconWrap}>
                    <Image source={service.image} style={styles.serviceImage} resizeMode="contain" />
                  </View>
                  <Text style={styles.serviceLabel}>{service.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={whenSheetVisible}
        transparent
        animationType="none"
        onRequestClose={closeWhenSheet}
        statusBarTranslucent
      >
        <View style={styles.sheetOverlayContainer} pointerEvents="box-none">
          <Animated.View style={[styles.sheetOverlay, { opacity: overlayOpacity }]} pointerEvents="none" />
          <Pressable style={styles.sheetOverlayTouchable} onPress={closeWhenSheet} />
          <Animated.View
            style={[styles.sheetContent, { transform: [{ translateY: sheetTranslateY }] }]}
            pointerEvents="box-none"
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Para quando você precisa da viagem?</Text>

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
                <Text style={styles.sheetOptionSubtitle}>Chame um carro imediatamente</Text>
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
        <View style={styles.timeSheetOverlayContainer} pointerEvents="box-none">
          <Animated.View style={[styles.timeSheetOverlay, { opacity: timeSheetOverlayOpacity }]} pointerEvents="none" />
          <Pressable style={styles.timeSheetOverlayTouchable} onPress={closeTimeSheet} />
          <Animated.View style={[styles.timeSheetContent, { transform: [{ translateY: timeSheetTranslateY }] }]} pointerEvents="box-none">
            <View style={styles.timeSheetHandle} />
            <Text style={styles.timeSheetTitle}>Escolha a hora</Text>
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 32,
  },
  searchRow: {
    marginBottom: 0,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.black,
    backgroundColor: COLORS.background,
    paddingLeft: 16,
    paddingRight: 8,
  },
  searchTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    paddingVertical: 12,
  },
  agendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 90,
    backgroundColor: COLORS.neutral300,
    gap: 6,
  },
  agendarText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.black,
    marginLeft: 4,
  },
  recentCard: {
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    borderRadius: 12,
    padding: 16,
    gap: 24,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  recentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentTextWrap: {
    flex: 1,
    gap: 2,
  },
  recentAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  recentCity: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.neutral700,
  },
  section: {
    gap: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.black,
  },
  servicesGrid: {
    gap: 12,
  },
  servicesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  serviceCard: {
    flex: 1,
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  serviceIconWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceImage: {
    width: 52,
    height: 52,
  },
  serviceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    textAlign: 'center',
  },
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
  sheetOverlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
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
  sheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 24,
  },
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
  sheetOptionSelected: {
    borderColor: COLORS.black,
  },
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
  sheetRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.black,
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
});
