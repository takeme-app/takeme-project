import { useState, useCallback, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { toISODate, formatDateDisplayLabel } from '../lib/dateTimeSlots';

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
  /** Ausente = dia inteiro (qualquer viagem ofertada na data). */
  scheduledTimeSlot?: string;
};

export function useWhenTimeSelection() {
  const [whenOption, setWhenOption] = useState<'now' | 'later' | null>(null);
  const [whenLabel, setWhenLabel] = useState('Agora');
  /** Mantém o dia após fechar o sheet (closeTimeSheet não limpa o dia escolhido). */
  const [committedLater, setCommittedLater] = useState<{ day: string } | null>(null);
  const [whenSheetVisible, setWhenSheetVisible] = useState(false);
  const [timeSheetVisible, setTimeSheetVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState(() => toISODate(new Date()));

  const whenOverlayOpacity = useRef(new Animated.Value(0)).current;
  const whenSheetTranslateY = useRef(new Animated.Value(WHEN_SHEET_SLIDE)).current;
  const timeSheetOverlayOpacity = useRef(new Animated.Value(0)).current;
  const timeSheetTranslateY = useRef(new Animated.Value(TIME_SHEET_SLIDE)).current;

  useEffect(() => {
    if (whenSheetVisible) animateOpen(whenOverlayOpacity, whenSheetTranslateY, WHEN_SHEET_SLIDE);
  }, [whenSheetVisible]);

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
    timeSheetOverlayOpacity.setValue(0);
    timeSheetTranslateY.setValue(TIME_SHEET_SLIDE);
    setTimeSheetVisible(true);
  }, []);

  const closeTimeSheet = useCallback(() => {
    timeSheetOverlayOpacity.setValue(0);
    timeSheetTranslateY.setValue(TIME_SHEET_SLIDE);
    setTimeSheetVisible(false);
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

  /** Chamado ao confirmar o dia no sheet de agendamento. */
  const handleSelectTime = useCallback((): WhenTimeResult | null => {
    if (!selectedDay) return null;
    const label = formatDateDisplayLabel(selectedDay);
    setCommittedLater({ day: selectedDay });
    setWhenOption('later');
    setWhenLabel(label);
    closeTimeSheet();
    return {
      whenOption: 'later',
      whenLabel: label,
      scheduledDateId: selectedDay,
      scheduledTimeSlot: undefined,
    };
  }, [selectedDay, closeTimeSheet]);

  const getResult = useCallback((): WhenTimeResult => {
    if (committedLater) {
      return {
        whenOption: 'later',
        whenLabel: formatDateDisplayLabel(committedLater.day),
        scheduledDateId: committedLater.day,
        scheduledTimeSlot: undefined,
      };
    }
    return {
      whenOption: whenOption === 'later' ? 'later' : 'now',
      whenLabel,
      scheduledDateId: whenOption === 'later' ? selectedDay : undefined,
      scheduledTimeSlot: undefined,
    };
  }, [committedLater, whenOption, whenLabel, selectedDay]);

  return {
    whenOption,
    setWhenOption,
    whenLabel,
    whenSheetVisible,
    timeSheetVisible,
    selectedDay,
    setSelectedDay,
    openWhenSheet,
    closeWhenSheet,
    openTimeSheet,
    closeTimeSheet,
    handleWhenContinue,
    handleSelectTime,
    getResult,
    whenOverlayOpacity,
    whenSheetTranslateY,
    timeSheetOverlayOpacity,
    timeSheetTranslateY,
  };
}
