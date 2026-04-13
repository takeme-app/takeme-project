import { useState, useCallback, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { toISODate } from '../lib/dateTimeSlots';

const WHEN_SHEET_SLIDE = 400;
const TIME_SHEET_SLIDE = 450;

function animateOpen(overlay: Animated.Value, translateY: Animated.Value, slideHeight: number) {
  overlay.setValue(0);
  translateY.setValue(slideHeight);
  Animated.sequence([
    Animated.timing(overlay, { toValue: 1, duration: 200, useNativeDriver: true }),
    Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
  ]).start();
}

export type WhenTimeResult = {
  whenOption: 'now' | 'later';
  whenLabel: string;
  scheduledDateId?: string;
  scheduledTimeSlot?: string;
};

export function useWhenTimeSelection() {
  const [whenOption, setWhenOption] = useState<'now' | 'later' | null>(null);
  const [whenLabel, setWhenLabel] = useState('Agora');
  /** Mantém data/hora após fechar o sheet (closeTimeSheet zera selectedSlot). */
  const [committedLater, setCommittedLater] = useState<{ day: string; slot: string } | null>(null);
  const [whenSheetVisible, setWhenSheetVisible] = useState(false);
  const [timeSheetVisible, setTimeSheetVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState(() => toISODate(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const whenOverlayOpacity = useRef(new Animated.Value(0)).current;
  const whenSheetTranslateY = useRef(new Animated.Value(WHEN_SHEET_SLIDE)).current;
  const timeSheetOverlayOpacity = useRef(new Animated.Value(0)).current;
  const timeSheetTranslateY = useRef(new Animated.Value(TIME_SHEET_SLIDE)).current;

  // Animar abertura do when-sheet
  useEffect(() => {
    if (whenSheetVisible) animateOpen(whenOverlayOpacity, whenSheetTranslateY, WHEN_SHEET_SLIDE);
  }, [whenSheetVisible]);

  // Animar abertura do time-sheet
  useEffect(() => {
    if (timeSheetVisible) animateOpen(timeSheetOverlayOpacity, timeSheetTranslateY, TIME_SHEET_SLIDE);
  }, [timeSheetVisible]);

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

  /** Chamado ao confirmar "Agora" ou "Mais tarde" no when-sheet. Retorna a opção ou null. */
  const handleWhenContinue = useCallback((): 'now' | 'later' | null => {
    if (whenOption === 'now') {
      setCommittedLater(null);
      setWhenLabel('Agora');
      closeWhenSheet();
      return 'now';
    }
    if (whenOption === 'later') {
      closeWhenSheet();
      openTimeSheet();
      return 'later';
    }
    return null;
  }, [whenOption, closeWhenSheet, openTimeSheet]);

  /** Chamado ao selecionar horário no time-sheet. Retorna o resultado ou null. */
  const handleSelectTime = useCallback((): WhenTimeResult | null => {
    if (!selectedSlot) return null;
    setCommittedLater({ day: selectedDay, slot: selectedSlot });
    setWhenOption('later');
    setWhenLabel(selectedSlot);
    closeTimeSheet();
    return {
      whenOption: 'later',
      whenLabel: selectedSlot,
      scheduledDateId: selectedDay,
      scheduledTimeSlot: selectedSlot,
    };
  }, [selectedSlot, selectedDay, closeTimeSheet]);

  const getResult = useCallback((): WhenTimeResult => {
    if (committedLater) {
      return {
        whenOption: 'later',
        whenLabel: committedLater.slot,
        scheduledDateId: committedLater.day,
        scheduledTimeSlot: committedLater.slot,
      };
    }
    return {
      whenOption: whenOption === 'later' ? 'later' : 'now',
      whenLabel,
      scheduledDateId: whenOption === 'later' ? selectedDay : undefined,
      scheduledTimeSlot: whenOption === 'later' && selectedSlot ? selectedSlot : undefined,
    };
  }, [committedLater, whenOption, whenLabel, selectedDay, selectedSlot]);

  return {
    whenOption,
    setWhenOption,
    whenLabel,
    whenSheetVisible,
    timeSheetVisible,
    selectedDay,
    setSelectedDay,
    selectedSlot,
    setSelectedSlot,
    showDatePicker,
    setShowDatePicker,
    openWhenSheet,
    closeWhenSheet,
    openTimeSheet,
    closeTimeSheet,
    handleWhenContinue,
    handleSelectTime,
    getResult,
    // Animated values
    whenOverlayOpacity,
    whenSheetTranslateY,
    timeSheetOverlayOpacity,
    timeSheetTranslateY,
  };
}
