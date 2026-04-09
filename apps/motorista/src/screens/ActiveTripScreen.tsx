import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  GoogleMapsMap,
  MapMarker,
  MapPolyline,
  MapZoomControls,
  type GoogleMapsMapRef,
  type LatLng,
  type MapRegion,
  regionFromLatLngPoints,
  isValidGlobeCoordinate,
  latLngFromDbColumns,
  MY_LOCATION_NAV_DELTA,
} from '../components/googleMaps';
import { supabase } from '../lib/supabase';
import { tripDisplayEarningsCents } from '../lib/driverTripEarnings';
import { closeConversationsForScheduledTrip } from '../lib/closeTripConversations';
import { useTripStops, type TripStop, STOP_TYPE_COLORS } from '../hooks/useTripStops';
import { Text } from '../components/Text';
import { useAppAlert } from '../contexts/AppAlertContext';
import { getRouteWithDuration, getMultiPointRoute, formatEta } from '../lib/route';
import { getGoogleMapsApiKey, getMapboxAccessToken } from '../lib/googleMapsConfig';
// expo-location — defensive import (needs native rebuild if just added)
let Location: any = null;
try { Location = require('expo-location'); } catch { /* not available yet */ }

type Props = NativeStackScreenProps<RootStackParamList, 'ActiveTrip'>;

const GOLD = '#C9A227';
const DARK = '#111827';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Stop = TripStop;

/** Helper — stop é coleta (embarque / pick-up) */
function isPickup(s: Stop) { return s.stopType === 'passenger_pickup' || s.stopType === 'package_pickup'; }
/** Helper — stop é de passageiro */
function isPassenger(s: Stop) { return s.stopType === 'passenger_pickup' || s.stopType === 'passenger_dropoff'; }
/** Helper — stop é de encomenda */
function isPackage(s: Stop) { return s.stopType === 'package_pickup' || s.stopType === 'package_dropoff'; }

function isRouteWaypointStop(s: Stop) {
  return s.stopType === 'excursion_stop' || s.stopType === 'trip_destination';
}

/** Ícone no mapa / sidebar: passageiro, encomenda (caixa), destino (bandeira), base, demais “place”. */
function StopKindMarkerIcon({
  stop,
  completed,
  color,
  size = 18,
}: {
  stop: Stop;
  completed: boolean;
  color: string;
  size?: number;
}) {
  if (completed) {
    return <MaterialIcons name="check" size={size} color={color} />;
  }
  if (isPassenger(stop)) {
    return <MaterialIcons name="person" size={size} color={color} />;
  }
  if (isPackage(stop)) {
    return <MaterialIcons name="inventory-2" size={size} color={color} />;
  }
  if (stop.stopType === 'trip_destination') {
    return <MaterialIcons name="flag" size={size} color={color} />;
  }
  if (stop.stopType === 'base_dropoff') {
    return <MaterialIcons name="business" size={size} color={color} />;
  }
  return <MaterialIcons name="place" size={size} color={color} />;
}

/** Rótulo curto no card inferior — nunca tratar desembarque de passageiro como “Entrega”. */
function stopPhaseShortLabel(s: Stop): string {
  switch (s.stopType) {
    case 'passenger_pickup':
      return 'Embarque';
    case 'passenger_dropoff':
      return 'Desembarque';
    case 'package_pickup':
      return 'Coleta';
    case 'package_dropoff':
      return 'Entrega';
    case 'excursion_stop':
      return 'Parada';
    case 'trip_destination':
      return 'Destino';
    case 'base_dropoff':
      return 'Base';
    default:
      return 'Viagem';
  }
}

function detailSheetTitle(stop: Stop | null): string {
  if (!stop) return '';
  switch (stop.stopType) {
    case 'passenger_pickup':
      return 'Detalhes do embarque';
    case 'passenger_dropoff':
      return 'Detalhes do desembarque';
    case 'package_pickup':
      return 'Detalhes da coleta';
    case 'package_dropoff':
      return `Entrega para ${stop.label}`;
    case 'excursion_stop':
      return 'Parada na rota';
    case 'trip_destination':
      return 'Destino da viagem';
    case 'base_dropoff':
      return 'Entrega na base';
    default:
      return 'Detalhes da parada';
  }
}

function confirmPickupTitle(stop: Stop | null | undefined): string {
  if (!stop) return 'Confirmar';
  if (stop.stopType === 'passenger_dropoff') return 'Confirmar desembarque';
  if (stop.stopType === 'trip_destination') return 'Concluir chegada';
  if (stop.stopType === 'excursion_stop') return 'Concluir parada';
  if (stop.stopType === 'package_pickup') return 'Confirmar coleta';
  return 'Confirmar embarque';
}

function confirmPickupSubtitle(stop: Stop | null | undefined): string {
  if (!stop) return '';
  if (stop.stopType === 'package_pickup') {
    return 'Insira o código informado pelo passageiro para confirmar a coleta.';
  }
  if (stop.stopType === 'package_dropoff') return '';
  if (isPackage(stop)) return 'Insira o código de 4 dígitos informado pelo remetente.';
  if (stop.stopType === 'passenger_dropoff') return 'Confirme que o passageiro desembarcou neste ponto.';
  if (stop.stopType === 'trip_destination') return 'Confirme a chegada ao destino da viagem.';
  if (stop.stopType === 'excursion_stop') return 'Confirme que esta parada na rota foi concluída.';
  return 'Confirme o embarque do passageiro.';
}

function confirmPickupButtonLabel(stop: Stop | null | undefined): string {
  if (!stop) return 'Confirmar';
  if (stop.stopType === 'passenger_dropoff') return 'Confirmar desembarque';
  if (isRouteWaypointStop(stop)) return 'Concluir';
  if (stop.stopType === 'package_pickup') return 'Confirmar coleta';
  return 'Confirmar embarque';
}

type TripRow = {
  id: string;
  origin_address: string;
  destination_address: string;
  departure_at: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  amount_cents: number | null;
  status: string;
  bookings?: { amount_cents: number; status: string }[] | null;
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

/** Ignora null, NaN e (0,0) — evita rotas para o Atlântico vindas do banco. */
function pickStopCoord(
  lat: number | null | undefined,
  lng: number | null | undefined,
): LatLng | undefined {
  const p = latLngFromDbColumns(lat, lng);
  if (!p || !isValidGlobeCoordinate(p.latitude, p.longitude)) return undefined;
  return { latitude: p.latitude, longitude: p.longitude };
}

function dedupeConsecutivePoints(pts: LatLng[]): LatLng[] {
  const out: LatLng[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && last.latitude === p.latitude && last.longitude === p.longitude) continue;
    out.push(p);
  }
  return out;
}

/**
 * Navegação: primeira parada restante com coordenadas válidas (cliente/encomenda/destino).
 * Ignora driver_origin caso ainda apareça em algum fluxo legado.
 */
function resolveNavigationDestination(
  stopsList: TripStop[],
  fromIndex: number,
  finalDest: LatLng | null,
): LatLng | null {
  for (let i = fromIndex; i < stopsList.length; i++) {
    const s = stopsList[i];
    if (s.stopType === 'driver_origin') continue;
    if (s.lat != null && s.lng != null && isValidGlobeCoordinate(s.lat, s.lng)) {
      return { latitude: s.lat, longitude: s.lng };
    }
  }
  return finalDest;
}

/** Pontos da viagem restante para polyline (GPS cobre o “início”; sem parada sintética de partida). */
function collectRemainingStopPoints(stopsList: TripStop[], fromIndex: number): LatLng[] {
  const pts: LatLng[] = [];
  for (let i = fromIndex; i < stopsList.length; i++) {
    const s = stopsList[i];
    if (s.stopType === 'driver_origin') continue;
    if (s.lat != null && s.lng != null && isValidGlobeCoordinate(s.lat, s.lng)) {
      pts.push({ latitude: s.lat, longitude: s.lng });
    }
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function ActiveTripScreen({ navigation, route }: Props) {
  const { tripId } = route.params;
  const { showAlert } = useAppAlert();
  const insets = useSafeAreaInsets();

  // Data
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [tripLoading, setTripLoading] = useState(true);
  const { stops, loading: stopsLoading } = useTripStops(tripId);
  const loading = tripLoading || stopsLoading;

  // State machine
  const [currentStopIndex, setCurrentStopIndex] = useState(0);

  // Routes
  const [driverRouteCoords, setDriverRouteCoords] = useState<LatLng[]>([]);
  const [stopsRouteCoords, setStopsRouteCoords] = useState<LatLng[]>([]);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);

  // Driver position
  const [driverPosition, setDriverPosition] = useState<LatLng | null>(null);
  const locationSub = useRef<any>(null);
  const mapRef = useRef<GoogleMapsMapRef>(null);
  const hasFramedDriverOnMap = useRef(false);
  const [followMyLocation, setFollowMyLocation] = useState(false);
  const followFirstAnimDoneRef = useRef(false);
  const locationPermissionWarned = useRef(false);
  const locationModuleWarned = useRef(false);

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
      if (!Location) {
        if (!locationModuleWarned.current) {
          locationModuleWarned.current = true;
          showAlert(
            'Localização',
            'O módulo de localização não está disponível. Faça um build nativo: expo run:android ou expo run:ios.',
          );
        }
        return;
      }
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!locationPermissionWarned.current) {
            locationPermissionWarned.current = true;
            showAlert(
              'Localização desativada',
              'Sem permissão o mapa não mostra sua posição nem a rota até a próxima parada. Ative nas configurações do aparelho.',
            );
          }
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy?.High ?? Location.Accuracy.Balanced,
        });
        if (active) {
          setDriverPosition({ latitude: current.coords.latitude, longitude: current.coords.longitude });
        }
        locationSub.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 8,
            timeInterval: 5000,
          },
          (loc: any) => {
            if (active) {
              setDriverPosition({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            }
          },
        );
      } catch {
        if (!locationPermissionWarned.current) {
          locationPermissionWarned.current = true;
          showAlert(
            'Localização',
            'Não foi possível obter o GPS. Verifique se a localização está ligada e tente de novo.',
          );
        }
      }
    }
    startLocation();
    return () => {
      active = false;
      locationSub.current?.remove?.();
    };
  }, [showAlert]);

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------

  const load = useCallback(async () => {
    setTripLoading(true);
    try {
      const { data: tripData } = await supabase
        .from('scheduled_trips')
        .select(
          'id, origin_address, destination_address, departure_at, origin_lat, origin_lng, destination_lat, destination_lng, amount_cents, status, bookings(amount_cents, status)'
        )
        .eq('id', tripId)
        .single();
      if (tripData) setTrip(tripData as TripRow);
    } finally {
      setTripLoading(false);
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

  /**
   * Dados do card inferior.
   * Se há paradas, usa a parada atual.
   * Se não há paradas (viagem direta sem passageiros/encomendas no roteiro),
   * mostra o destino da viagem como destino único.
   */
  const cardInfo = useMemo((): Stop | null => {
    if (currentStop) return currentStop;
    if (!trip) return null;
    return {
      id: 'trip-dest',
      scheduledTripId: trip.id,
      stopType: 'passenger_dropoff',
      entityId: trip.id,
      label: trip.destination_address,
      address: trip.destination_address,
      lat: trip.destination_lat ?? null,
      lng: trip.destination_lng ?? null,
      sequenceOrder: 0,
      status: 'pending',
      notes: null,
      code: null,
    };
  }, [currentStop, trip]);

  const completedTripEarningsLabel = useMemo(() => {
    if (!trip) return '—';
    const cents = tripDisplayEarningsCents(trip.bookings, trip.amount_cents);
    return cents > 0 ? `R$ ${(cents / 100).toFixed(2).replace('.', ',')}` : '—';
  }, [trip]);

  /** Último ponto válido do roteiro (entrega final / última parada) ou destino da viagem. */
  const finalDestination = useMemo((): LatLng | null => {
    for (let i = stops.length - 1; i >= 0; i--) {
      const s = stops[i];
      if (
        s.lat != null &&
        s.lng != null &&
        isValidGlobeCoordinate(s.lat, s.lng)
      ) {
        return { latitude: s.lat, longitude: s.lng };
      }
    }
    if (!trip) return null;
    return pickStopCoord(trip.destination_lat, trip.destination_lng) ?? null;
  }, [stops, trip]);

  const fallbackNavDest = useMemo(
    () => resolveNavigationDestination(stops, currentStopIndex, finalDestination),
    [stops, currentStopIndex, finalDestination],
  );

  /** ~100m de resolução: atualiza rota dourada “você → destino” sem spammar Directions a cada tick de GPS. */
  const driverPositionKey = useMemo(() => {
    if (
      !driverPosition ||
      !isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude)
    ) {
      return '';
    }
    return `${driverPosition.latitude.toFixed(3)},${driverPosition.longitude.toFixed(3)}`;
  }, [driverPosition]);

  const tripDestLL = useMemo(
    () => (trip ? pickStopCoord(trip.destination_lat, trip.destination_lng) : undefined),
    [trip?.destination_lat, trip?.destination_lng, trip?.id],
  );

  /** Evita dois botões com bandeira: parada trip_destination ou mesmo lugar do destino da viagem. */
  const showSidebarTripEndFlag = useMemo(() => {
    if (!tripDestLL) return false;
    if (stops.some((s) => s.stopType === 'trip_destination')) return false;
    const tlat = tripDestLL.latitude;
    const tlng = tripDestLL.longitude;
    const nearDeg = 0.002;
    return !stops.some(
      (s) =>
        s.lat != null &&
        s.lng != null &&
        Math.abs(s.lat - tlat) < nearDeg &&
        Math.abs(s.lng - tlng) < nearDeg,
    );
  }, [stops, tripDestLL]);

  /**
   * Rota dourada: posição atual (GPS) → paradas da rota (cliente/encomenda/destino).
   * Paradas `driver_origin` não são carregadas no app.
   */
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const routeOpts = { mapboxToken: getMapboxAccessToken(), googleMapsApiKey: getGoogleMapsApiKey() };

    const stopPts = dedupeConsecutivePoints(collectRemainingStopPoints(stops, currentStopIndex));

    (async () => {
      if (stopPts.length >= 2) {
        const withDriver =
          driverPosition &&
          isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude)
            ? dedupeConsecutivePoints([driverPosition, ...stopPts])
            : stopPts;
        const r = await getMultiPointRoute(withDriver, routeOpts);
        if (!cancelled && r?.coordinates?.length) {
          setStopsRouteCoords(r.coordinates);
          return;
        }
      }
      if (
        driverPosition &&
        isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude) &&
        stopPts.length === 1
      ) {
        const r = await getRouteWithDuration(driverPosition, stopPts[0]!, routeOpts);
        if (!cancelled && r?.coordinates?.length) {
          setStopsRouteCoords(r.coordinates);
          return;
        }
      }
      const navDest = resolveNavigationDestination(stops, currentStopIndex, finalDestination);
      if (
        driverPosition &&
        isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude) &&
        navDest
      ) {
        const r = await getRouteWithDuration(driverPosition, navDest, routeOpts);
        if (!cancelled && r?.coordinates?.length) {
          setStopsRouteCoords(r.coordinates);
          return;
        }
      }
      if (!cancelled) setStopsRouteCoords([]);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, stops, finalDestination, driverPositionKey, currentStopIndex]);

  // Trecho escuro: GPS → próximo alvo útil na lista de paradas.
  useEffect(() => {
    if (
      !driverPosition ||
      !isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude)
    ) {
      return;
    }

    const dest =
      stops.length > 0
        ? resolveNavigationDestination(stops, currentStopIndex, finalDestination)
        : finalDestination;

    if (!dest) return;

    getRouteWithDuration(driverPosition, dest, {
      mapboxToken: getMapboxAccessToken(),
      googleMapsApiKey: getGoogleMapsApiKey(),
    })
      .then((result) => {
        if (result) {
          setDriverRouteCoords(result.coordinates);
          setEtaSeconds(result.durationSeconds);
        }
      })
      .catch(() => {});
  }, [driverPosition, currentStopIndex, stops, finalDestination]);

  // Região inicial: paradas relevantes + destino (sem priorizar origem cadastrada da viagem).
  const mapInitialRegion = useMemo((): MapRegion => {
    const pts = collectRemainingStopPoints(stops, 0);
    if (tripDestLL) pts.push(tripDestLL);
    if (pts.length > 0) return regionFromLatLngPoints(pts);
    if (tripDestLL) {
      return {
        latitude: tripDestLL.latitude,
        longitude: tripDestLL.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }
    return {
      latitude: -2.53,
      longitude: -44.3,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    };
  }, [trip?.id, tripDestLL, stops]);

  const overlayTop = insets.top + 56;

  const focusStopOnMap = useCallback(
    (idx: number) => {
      const stop = stops[idx];
      if (!stop) return;
      setFollowMyLocation(false);
      const hasCoord =
        stop.lat != null && stop.lng != null && isValidGlobeCoordinate(stop.lat, stop.lng);
      const baseLat = mapInitialRegion.latitude;
      const baseLng = mapInitialRegion.longitude;
      const lat = hasCoord ? stop.lat! : baseLat + idx * 0.002;
      const lng = hasCoord ? stop.lng! : baseLng + idx * 0.002;
      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: 0.045, longitudeDelta: 0.045 },
        400,
      );
    },
    [stops, mapInitialRegion.latitude, mapInitialRegion.longitude],
  );

  const focusTripDestinationOnMap = useCallback(() => {
    if (!tripDestLL) return;
    setFollowMyLocation(false);
    mapRef.current?.animateToRegion(
      {
        latitude: tripDestLL.latitude,
        longitude: tripDestLL.longitude,
        latitudeDelta: 0.045,
        longitudeDelta: 0.045,
      },
      400,
    );
  }, [tripDestLL]);

  /** Sem GPS e sem nenhuma coordenada de viagem/paradas → não confundir com mapa “real” centrado no BR. */
  const activeTripMapReady = useMemo(() => {
    if (loading) return true;
    if (
      driverPosition &&
      isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude)
    )
      return true;
    if (tripDestLL) return true;
    return stops.some(
      (s) =>
        s.lat != null &&
        s.lng != null &&
        isValidGlobeCoordinate(s.lat, s.lng),
    );
  }, [loading, driverPosition, tripDestLL, stops]);

  // Primeira posição GPS: centraliza no motorista com zoom 16.
  useEffect(() => {
    if (loading || !driverPosition || hasFramedDriverOnMap.current) return;
    if (!isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude)) return;
    const id = requestAnimationFrame(() => {
      mapRef.current?.animateToRegion(
        {
          latitude: driverPosition.latitude,
          longitude: driverPosition.longitude,
          latitudeDelta: MY_LOCATION_NAV_DELTA,
          longitudeDelta: MY_LOCATION_NAV_DELTA,
        },
        500,
      );
    });
    hasFramedDriverOnMap.current = true;
    return () => cancelAnimationFrame(id);
  }, [loading, driverPosition]);

  /** Toque em “minha localização”: zoom alto e câmera segue o GPS até gesto no mapa. */
  useEffect(() => {
    if (!followMyLocation) {
      followFirstAnimDoneRef.current = false;
      return;
    }
    if (!driverPosition || !isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude)) return;
    const dur = followFirstAnimDoneRef.current ? 0 : 350;
    followFirstAnimDoneRef.current = true;
    mapRef.current?.animateToRegion(
      {
        latitude: driverPosition.latitude,
        longitude: driverPosition.longitude,
        latitudeDelta: MY_LOCATION_NAV_DELTA,
        longitudeDelta: MY_LOCATION_NAV_DELTA,
      },
      dur,
    );
  }, [driverPosition, followMyLocation]);

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

    if (isPackage(currentStop)) {
      if (confirmCode.trim().length !== 4) {
        setConfirmError('O código deve ter 4 dígitos.');
        return;
      }
      if (currentStop.code && confirmCode.trim() !== currentStop.code) {
        setConfirmError('Código incorreto. Verifique com o cliente.');
        return;
      }
      const now = new Date().toISOString();
      if (isPickup(currentStop)) {
        await supabase.from('shipments').update({ picked_up_at: now } as never).eq('id', currentStop.entityId);
      } else {
        await supabase.from('shipments').update({ delivered_at: now } as never).eq('id', currentStop.entityId);
      }
    }

    // Mark stop as completed in trip_stops (best-effort — table may not exist yet)
    if (!currentStop.id.startsWith('booking-') && !currentStop.id.startsWith('shipment-')) {
      await supabase
        .from('trip_stops')
        .update({ status: 'completed' } as never)
        .eq('id', currentStop.id)
        .catch(() => {});
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
      await closeConversationsForScheduledTrip(tripId);
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

      {/* ── Mapa (Google Maps) ───────────────────────────── */}
      <GoogleMapsMap
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={mapInitialRegion}
        onUserAdjustedMap={() => setFollowMyLocation(false)}
      >
        {/* Route from driver to current stop (dark) */}
        {driverRouteCoords.length >= 2 && (
          <MapPolyline id="driver" coordinates={driverRouteCoords} strokeColor={DARK} strokeWidth={3} />
        )}

        {/* Full route between stops (gold) */}
        {stopsRouteCoords.length >= 2 && (
          <MapPolyline id="stops" coordinates={stopsRouteCoords} strokeColor={GOLD} strokeWidth={5} />
        )}

        {/* Fallback: linha reta só entre pontos válidos (nunca 0,0) se Directions/OSRM falharem */}
        {stopsRouteCoords.length < 2 &&
          driverPosition &&
          isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude) &&
          fallbackNavDest && (
          <MapPolyline
            id="fallback"
            coordinates={[driverPosition, fallbackNavDest]}
            strokeColor={GOLD}
            strokeWidth={4}
          />
        )}

        {/* Stop markers */}
        {stops.map((stop, idx) => {
          const hasCoord =
            stop.lat != null &&
            stop.lng != null &&
            isValidGlobeCoordinate(stop.lat, stop.lng);
          const baseLat = mapInitialRegion.latitude;
          const baseLng = mapInitialRegion.longitude;
          const lat = hasCoord ? stop.lat! : baseLat + idx * 0.002;
          const lng = hasCoord ? stop.lng! : baseLng + idx * 0.002;
          const isCompleted = idx < currentStopIndex;
          const markerBg = isCompleted ? '#374151' : STOP_TYPE_COLORS[stop.stopType];
          return (
            <MapMarker
              key={stop.id}
              id={stop.id}
              coordinate={{ latitude: lat, longitude: lng }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.mapMarker, { backgroundColor: markerBg }]}>
                <StopKindMarkerIcon stop={stop} completed={isCompleted} color="#fff" />
              </View>
            </MapMarker>
          );
        })}

        {/* Driver position marker */}
        {driverPosition && (
          <MapMarker
            id="driver"
            coordinate={driverPosition}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.driverPulse}>
              <View style={styles.driverMarker}>
                <MaterialIcons name="play-arrow" size={18} color="#fff" />
              </View>
            </View>
          </MapMarker>
        )}
      </GoogleMapsMap>

      {!activeTripMapReady && (
        <View style={styles.mapCoordsLoading} pointerEvents="none">
          <ActivityIndicator size="large" color={DARK} />
          <Text style={styles.mapCoordsLoadingText}>Carregando mapa…</Text>
        </View>
      )}

      {/* ── Overlay UI (mesmo padrão da coleta ativa / Mapbox) ── */}
      <SafeAreaView edges={['top', 'bottom']} style={StyleSheet.absoluteFillObject} pointerEvents="box-none">

        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 8, left: 14 }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <MaterialIcons name="arrow-back" size={20} color={DARK} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.myLocationBtn, { top: overlayTop, left: 14 }]}
          activeOpacity={0.8}
          onPress={() => {
            if (!driverPosition || !isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude)) return;
            setFollowMyLocation(true);
          }}
        >
          <MaterialIcons name="my-location" size={22} color={DARK} />
        </TouchableOpacity>

        <View style={[styles.zoomWrap, { top: overlayTop + 46 + 10, left: 14 }]} pointerEvents="box-none">
          <MapZoomControls
            mapRef={mapRef}
            floating={false}
            onBeforeZoom={() => setFollowMyLocation(false)}
          />
        </View>

        {(stops.length > 0 || showSidebarTripEndFlag) && (
          <View style={[styles.sidebar, { top: overlayTop, right: 14 }]} pointerEvents="box-none">
            {(stops.length + (showSidebarTripEndFlag ? 1 : 0)) > 1 && (
              <View style={styles.sidebarLine} pointerEvents="none" />
            )}

            {stops.map((stop, idx) => {
              const isCompleted = idx < currentStopIndex;
              const isCurrent = idx === currentStopIndex;
              const btnBg = isCompleted ? '#9CA3AF' : isCurrent ? STOP_TYPE_COLORS[stop.stopType] : '#E5E7EB';
              const iconColor = isCompleted || isCurrent ? '#fff' : '#6B7280';
              return (
                <TouchableOpacity
                  key={stop.id}
                  style={[styles.sidebarBtn, { backgroundColor: btnBg }]}
                  onPress={() => focusStopOnMap(idx)}
                  activeOpacity={0.8}
                >
                  <StopKindMarkerIcon stop={stop} completed={isCompleted} color={iconColor} />
                </TouchableOpacity>
              );
            })}

            {showSidebarTripEndFlag && (
              <TouchableOpacity
                style={[styles.sidebarBtn, styles.sidebarDestBtn]}
                onPress={focusTripDestinationOnMap}
                activeOpacity={0.85}
              >
                <MaterialIcons name="flag" size={18} color={DARK} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Mini bottom card — sempre visível quando há viagem ativa */}
        {cardInfo && !detailVisible && !allDone && (
          <TouchableOpacity
            style={styles.miniSheet}
            onPress={currentStop ? openDetail : undefined}
            activeOpacity={currentStop ? 0.95 : 1}
          >
            <View style={styles.miniSheetTopRow}>
              <View style={[
                styles.stopTypePill,
                isPassenger(cardInfo) && styles.stopTypePillTrip,
              ]}>
                <View style={styles.stopTypeDot} />
                <Text style={styles.stopTypePillText}>
                  {stopPhaseShortLabel(cardInfo)}
                </Text>
              </View>
              {etaSeconds !== null && (
                <View style={styles.etaBadge}>
                  <Text style={styles.etaBadgeText}>{Math.max(1, Math.round(etaSeconds / 60))} min</Text>
                </View>
              )}
            </View>

            <Text style={styles.miniSheetName} numberOfLines={1}>
              {totalStops > 0 ? cardInfo.label : (trip?.origin_address ?? cardInfo.label)}
            </Text>

            <View style={styles.addressRow}>
              <MaterialIcons name="location-on" size={14} color="#6B7280" />
              <Text style={styles.addressText} numberOfLines={1}>{cardInfo.address}</Text>
            </View>

            {totalStops > 0 && (
              <View style={styles.miniSheetFooter}>
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
            )}
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
              {detailSheetTitle(currentStop)}
            </Text>
            <TouchableOpacity style={styles.iconCircleBtn} activeOpacity={0.7}>
              <MaterialIcons name="phone" size={20} color={DARK} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScroll}>
            {currentStop && isPickup(currentStop) ? (
              <>
                <View style={styles.avatarCenter}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitials}>{getInitials(currentStop?.label ?? '?')}</Text>
                  </View>
                </View>
                <Text style={styles.detailName}>{currentStop?.label}</Text>
                <View style={styles.detailMetaRow}>
                </View>
                <Text style={styles.detailLabel}>
                  {currentStop.stopType === 'package_pickup' ? 'Endereço da coleta' : 'Endereço do embarque'}
                </Text>
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
                  <Text style={styles.actionBtnText}>
                    {currentStop.stopType === 'package_pickup' ? 'Iniciar coleta' : 'Iniciar embarque'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>
                    {currentStop.stopType === 'package_pickup' ? 'Cancelar coleta' : 'Cancelar embarque'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : currentStop && currentStop.stopType === 'passenger_dropoff' ? (
              <>
                <View style={styles.avatarCenter}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitials}>{getInitials(currentStop?.label ?? '?')}</Text>
                  </View>
                </View>
                <Text style={styles.detailName}>{currentStop.label}</Text>
                <Text style={styles.detailLabel}>Endereço do desembarque</Text>
                <Text style={styles.detailValue}>{currentStop.address}</Text>
                {currentStop.notes ? (
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
                  <Text style={styles.actionBtnText}>Confirmar desembarque</Text>
                </TouchableOpacity>
              </>
            ) : currentStop && isRouteWaypointStop(currentStop) ? (
              <>
                <View style={styles.avatarCenter}>
                  <View
                    style={[
                      styles.avatarCircle,
                      { backgroundColor: STOP_TYPE_COLORS[currentStop.stopType] },
                    ]}
                  >
                    <MaterialIcons
                      name={currentStop.stopType === 'trip_destination' ? 'flag' : 'place'}
                      size={26}
                      color="#fff"
                    />
                  </View>
                </View>
                <Text style={styles.detailName}>{currentStop.label}</Text>
                <Text style={styles.detailLabel}>Local</Text>
                <Text style={styles.detailValue}>{currentStop.address}</Text>
                {currentStop.notes ? (
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
                  <Text style={styles.actionBtnText}>
                    {currentStop.stopType === 'trip_destination' ? 'Concluir chegada' : 'Concluir parada'}
                  </Text>
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
                    <Text style={{ fontWeight: '700' }}>{currentStop?.label}</Text>
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
            <Text style={styles.centeredModalTitle}>{confirmPickupTitle(currentStop)}</Text>
            <Text style={styles.centeredModalSubtitle}>{confirmPickupSubtitle(currentStop)}</Text>
            {currentStop && isPackage(currentStop) && (
              <>
                <Text style={styles.fieldLabel}>Código de coleta</Text>
                <TextInput
                  style={styles.codeInput}
                  value={confirmCode}
                  onChangeText={(v) => { setConfirmCode(v.replace(/\D/g, '').slice(0, 4)); setConfirmError(''); }}
                  keyboardType="numeric"
                  maxLength={4}
                  placeholder="Ex: 1234"
                  placeholderTextColor="#9CA3AF"
                  textAlign="center"
                />
              </>
            )}
            {confirmError ? <Text style={styles.errorText}>{confirmError}</Text> : null}
            <TouchableOpacity style={styles.actionBtn} onPress={handleConfirmStop} activeOpacity={0.85}>
              <Text style={styles.actionBtnText}>{confirmPickupButtonLabel(currentStop)}</Text>
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
              Insira o código informado pelo cliente para confirmar a entrega.
            </Text>
            <Text style={styles.fieldLabel}>Código de entrega</Text>
            <TextInput
              style={styles.codeInput}
              value={confirmCode}
              onChangeText={(v) => { setConfirmCode(v.replace(/\D/g, '').slice(0, 4)); setConfirmError(''); }}
              keyboardType="numeric"
              maxLength={4}
              placeholder="Ex: 1234"
              placeholderTextColor="#9CA3AF"
              textAlign="center"
            />
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
                {stopsRouteCoords.length >= 2 ? `~${Math.round(stopsRouteCoords.length * 0.02)} km` : '—'}
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
                <Text style={styles.completedStatValue}>{completedTripEarningsLabel}</Text>
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
  mapCoordsLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,245,245,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  mapCoordsLoadingText: { fontSize: 14, color: '#6B7280' },

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

  // ── My location button — lado esquerdo ───────────────────
  backBtn: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },

  zoomWrap: { position: 'absolute' },

  myLocationBtn: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },

  // ── Right sidebar ─────────────────────────────────────────
  sidebar: {
    position: 'absolute',
    alignItems: 'center',
    gap: 6,
  },
  sidebarLine: {
    position: 'absolute',
    top: 22,
    bottom: 22,
    width: 2,
    backgroundColor: '#D1D5DB',
    zIndex: -1,
  },
  sidebarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  sidebarDestBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },

  // ── Mini bottom sheet — card flutuante ────────────────────
  miniSheet: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 20,
    left: 14,
    right: 14,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 12,
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
  stopTypePillTrip: {
    backgroundColor: '#FEF3C7',
  },
  stopTypeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: GOLD,
  },
  stopTypePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 0.2,
  },
  etaBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  etaBadgeText: {
    color: DARK,
    fontSize: 14,
    fontWeight: '700',
  },
  miniSheetName: {
    fontSize: 21,
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
  miniSheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  progressBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: GOLD,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
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
