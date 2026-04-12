import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
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
  useWindowDimensions,
  Alert,
  Image,
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
import { getUserErrorMessage, isTripRatingsUnavailableError } from '../utils/errorMessage';
import { insertPlannedRouteSlotAfterComplete } from '../lib/insertPlannedRouteSlotAfterComplete';
import {
  buildNavigationPadding,
  computeNextNavigationCamera,
  createInitialBearingState,
  type DriverFix,
  type NavigationBearingState,
} from '../lib/navigationCamera';
import { snapToRoutePolyline, trimPolylineFromSnap } from '../lib/routeSnap';
import * as ImagePicker from 'expo-image-picker';
// expo-location — defensive import (needs native rebuild if just added)
let Location: any = null;
try { Location = require('expo-location'); } catch { /* not available yet */ }

/** Distância máxima para projetar o GPS na polyline (map matching simples). */
const NAV_ROUTE_SNAP_MAX_M = 52;
/** Abaixo disso, o bearing da câmera prioriza o segmento da rota (alinha com a linha). */
const NAV_ROAD_BEARING_SNAP_M = 40;
const NAV_LOOK_AHEAD_M = 56;
const NAV_CAMERA_ANIMATION_MS = 320;

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
  route_id?: string | null;
  day_of_week?: number | null;
  departure_time?: string | null;
  arrival_time?: string | null;
  capacity?: number | null;
  price_per_person_cents?: number | null;
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
  const { height: windowHeight } = useWindowDimensions();

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
  const locationPermissionWarned = useRef(false);
  const locationModuleWarned = useRef(false);

  /** Seguir GPS em modo navegação (heading-up); ref lida com callbacks antes do paint. */
  const followNavRef = useRef(false);
  const latestDriverFixRef = useRef<DriverFix | null>(null);
  const compassHeadingRef = useRef<number | null>(null);
  const navBearingStateRef = useRef<NavigationBearingState | null>(null);
  const navRafRef = useRef<number | null>(null);
  /** Polyline usada para snap + bearing da via (prioridade: rota dourada, senão trecho escuro). */
  const routeForSnapRef = useRef<LatLng[]>([]);

  // UI state
  const [detailVisible, setDetailVisible] = useState(false);
  const [confirmPickupVisible, setConfirmPickupVisible] = useState(false);
  const [confirmDeliveryVisible, setConfirmDeliveryVisible] = useState(false);
  const [finalizeVisible, setFinalizeVisible] = useState(false);
  const [completedVisible, setCompletedVisible] = useState(false);

  // Confirm modal inputs
  const [confirmCode, setConfirmCode] = useState('');
  const [confirmError, setConfirmError] = useState('');

  // Finalize — comprovantes (fotos) enviados ao storage ao concluir a viagem
  const [tripExpenseFiles, setTripExpenseFiles] = useState<{ uri: string; mimeType: string; name: string }[]>([]);
  const [finalizingTrip, setFinalizingTrip] = useState(false);

  // Rating
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Animations
  const detailSlide = useRef(new Animated.Value(600)).current;
  const finalizeSlide = useRef(new Animated.Value(600)).current;
  /** Coleta/entrega: só um sheet de código visível por vez — um único translateY. */
  const confirmSheetSlide = useRef(new Animated.Value(600)).current;
  const completedSlide = useRef(new Animated.Value(600)).current;

  // ---------------------------------------------------------------------------
  // Câmera heading-up (navegação tipo Waze)
  // ---------------------------------------------------------------------------

  const applyHeadingUpCamera = useCallback(() => {
    if (!followNavRef.current || !mapRef.current) return;
    const raw = latestDriverFixRef.current;
    if (!raw || !isValidGlobeCoordinate(raw.latitude, raw.longitude)) return;
    if (!navBearingStateRef.current) {
      navBearingStateRef.current = createInitialBearingState(0);
    }
    const guide = routeForSnapRef.current;
    let fix: DriverFix = raw;
    let roadCourseDeg: number | null = null;
    if (guide.length >= 2) {
      const snap = snapToRoutePolyline(
        { latitude: raw.latitude, longitude: raw.longitude },
        guide,
        NAV_ROUTE_SNAP_MAX_M,
      );
      if (snap.distanceM <= NAV_ROUTE_SNAP_MAX_M) {
        fix = {
          ...raw,
          latitude: snap.snapped.latitude,
          longitude: snap.snapped.longitude,
        };
        if (snap.distanceM <= NAV_ROAD_BEARING_SNAP_M) {
          roadCourseDeg = snap.segmentBearingDeg;
        }
      }
    }
    const padding = buildNavigationPadding({
      windowHeight,
      safeTop: insets.top,
      safeBottom: insets.bottom,
    });
    const out = computeNextNavigationCamera({
      fix,
      compassHeadingDeg: compassHeadingRef.current,
      state: navBearingStateRef.current,
      lookAheadMeters: NAV_LOOK_AHEAD_M,
      roadCourseDeg,
    });
    navBearingStateRef.current = out.state;
    mapRef.current.setNavigationCamera({
      centerCoordinate: [out.center.longitude, out.center.latitude],
      heading: out.heading,
      pitch: out.pitch,
      zoomLevel: out.zoomLevel,
      padding,
      animationDuration: NAV_CAMERA_ANIMATION_MS,
    });
  }, [windowHeight, insets.top, insets.bottom]);

  const scheduleNavFrame = useCallback(() => {
    if (!followNavRef.current) return;
    if (navRafRef.current != null) return;
    navRafRef.current = requestAnimationFrame(() => {
      navRafRef.current = null;
      applyHeadingUpCamera();
    });
  }, [applyHeadingUpCamera]);

  useLayoutEffect(() => {
    followNavRef.current = followMyLocation;
    if (followMyLocation) {
      navBearingStateRef.current = createInitialBearingState(0);
      requestAnimationFrame(() => scheduleNavFrame());
    } else if (navRafRef.current != null) {
      cancelAnimationFrame(navRafRef.current);
      navRafRef.current = null;
    }
  }, [followMyLocation, scheduleNavFrame]);

  useEffect(
    () => () => {
      if (navRafRef.current != null) {
        cancelAnimationFrame(navRafRef.current);
        navRafRef.current = null;
      }
    },
    [],
  );

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
          const la = current.coords.latitude;
          const lo = current.coords.longitude;
          setDriverPosition({ latitude: la, longitude: lo });
          latestDriverFixRef.current = {
            latitude: la,
            longitude: lo,
            speedMps:
              typeof current.coords.speed === 'number' && current.coords.speed >= 0
                ? current.coords.speed
                : null,
            headingDeg:
              typeof current.coords.heading === 'number' && current.coords.heading >= 0
                ? current.coords.heading
                : null,
            timestamp: Date.now(),
          };
        }
        locationSub.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy?.High ?? Location.Accuracy.Balanced,
            distanceInterval: 4,
            timeInterval: 1000,
          },
          (loc: any) => {
            if (!active) return;
            const la = loc.coords.latitude;
            const lo = loc.coords.longitude;
            setDriverPosition({ latitude: la, longitude: lo });
            latestDriverFixRef.current = {
              latitude: la,
              longitude: lo,
              speedMps:
                typeof loc.coords.speed === 'number' && loc.coords.speed >= 0 ? loc.coords.speed : null,
              headingDeg:
                typeof loc.coords.heading === 'number' && loc.coords.heading >= 0 ? loc.coords.heading : null,
              timestamp: Date.now(),
            };
            if (followNavRef.current) scheduleNavFrame();
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
  }, [showAlert, scheduleNavFrame]);

  /** Bússola em baixa velocidade (< ~5 km/h); fallback quando o curso do GPS é fraco. */
  useEffect(() => {
    if (!followMyLocation || !Location?.watchHeadingAsync) return;
    let cancelled = false;
    let sub: { remove: () => void } | undefined;
    (async () => {
      try {
        const s = await Location.watchHeadingAsync((h: {
          trueHeading?: number;
          magHeading?: number;
        }) => {
          const th = h.trueHeading;
          const mh = h.magHeading;
          const v =
            typeof th === 'number' && th >= 0
              ? th
              : typeof mh === 'number' && mh >= 0
                ? mh
                : null;
          if (v != null) compassHeadingRef.current = v;
          if (followNavRef.current) scheduleNavFrame();
        });
        if (!cancelled) sub = s;
      } catch {
        /* Android / permissão / hardware */
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, [followMyLocation, scheduleNavFrame]);

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------

  const load = useCallback(async () => {
    setTripLoading(true);
    try {
      const { data: tripData } = await supabase
        .from('scheduled_trips')
        .select(
          [
            'id, origin_address, destination_address, departure_at, origin_lat, origin_lng,',
            'destination_lat, destination_lng, amount_cents, status,',
            'route_id, day_of_week, departure_time, arrival_time, capacity, price_per_person_cents,',
            'bookings(amount_cents, status)',
          ].join(' '),
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

  /** Mesma heurística do sheet “Finalizar viagem” (polyline em pontos). */
  const tripDistanceApproxLabel = useMemo(
    () => (stopsRouteCoords.length >= 2 ? `~${Math.round(stopsRouteCoords.length * 0.02)} km` : '—'),
    [stopsRouteCoords.length],
  );

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

  useEffect(() => {
    if (stopsRouteCoords.length >= 2) routeForSnapRef.current = stopsRouteCoords;
    else if (driverRouteCoords.length >= 2) routeForSnapRef.current = driverRouteCoords;
    else routeForSnapRef.current = [];
  }, [stopsRouteCoords, driverRouteCoords]);

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

  /**
   * Modo seguir: apara a polyline a partir do ponto colado na via (linha começa no “carro”).
   * Fora do modo seguir: mantém as polylines completas.
   */
  const navRoutePresentation = useMemo(() => {
    const goldBase = stopsRouteCoords;
    const darkBase = driverRouteCoords;
    const guide =
      goldBase.length >= 2 ? goldBase : darkBase.length >= 2 ? darkBase : [];

    if (
      !followMyLocation ||
      !driverPosition ||
      !isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude)
    ) {
      return {
        goldLine: goldBase,
        darkLine: darkBase,
        showGold: goldBase.length >= 2,
        showDark: darkBase.length >= 2,
        snappedForFallback: null as LatLng | null,
      };
    }
    if (guide.length < 2) {
      return {
        goldLine: goldBase,
        darkLine: darkBase,
        showGold: goldBase.length >= 2,
        showDark: darkBase.length >= 2,
        snappedForFallback: null,
      };
    }
    const snap = snapToRoutePolyline(driverPosition, guide, NAV_ROUTE_SNAP_MAX_M);
    if (snap.distanceM > NAV_ROUTE_SNAP_MAX_M) {
      return {
        goldLine: goldBase,
        darkLine: darkBase,
        showGold: goldBase.length >= 2,
        showDark: darkBase.length >= 2,
        snappedForFallback: null,
      };
    }
    let trimmed = trimPolylineFromSnap(guide, snap.segmentIndex, snap.snapped);
    if (trimmed.length < 2 && guide.length >= 2) {
      trimmed = [snap.snapped, guide[guide.length - 1]];
    }
    if (goldBase.length >= 2) {
      return {
        goldLine: trimmed.length >= 2 ? trimmed : goldBase,
        darkLine: [] as LatLng[],
        showGold: trimmed.length >= 2,
        showDark: false,
        snappedForFallback: snap.snapped,
      };
    }
    return {
      goldLine: goldBase,
      darkLine: trimmed.length >= 2 ? trimmed : darkBase,
      showGold: false,
      showDark: trimmed.length >= 2,
      snappedForFallback: snap.snapped,
    };
  }, [followMyLocation, driverPosition, stopsRouteCoords, driverRouteCoords]);

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

  /** Posição vertical do “puck” fixo na tela (~68% da altura) em modo navegação. */
  const navPuckTopPx = useMemo(() => Math.round(windowHeight * 0.68 - 24), [windowHeight]);

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

  /** Fecha o sheet sem animar — use quando o modal de detalhe já está invisível (ex.: fluxo só com modal de confirmação). Animar `detailSlide` com Modal desmontado trava no iOS. */
  const syncCloseDetailOnly = () => {
    detailSlide.setValue(600);
    setDetailVisible(false);
  };

  const openFinalize = () => {
    setTripExpenseFiles([]);
    finalizeSlide.setValue(600);
    setFinalizeVisible(true);
    Animated.spring(finalizeSlide, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  };

  const closeFinalize = () => {
    Animated.timing(finalizeSlide, { toValue: 600, duration: 250, useNativeDriver: true }).start(() => {
      setFinalizeVisible(false);
      setTripExpenseFiles([]);
    });
  };

  const handlePickTripExpenses = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permissão', 'Precisamos de acesso às fotos para anexar comprovantes de despesa.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 8,
    });
    if (result.canceled || !result.assets?.length) return;
    setTripExpenseFiles((prev) => {
      const next = [...prev];
      for (const a of result.assets) {
        const mime = a.mimeType ?? 'image/jpeg';
        const name = a.fileName ?? `comprovante-${Date.now()}.jpg`;
        next.push({ uri: a.uri, mimeType: mime, name });
      }
      return next.slice(0, 8);
    });
  };

  const removeTripExpenseAt = (index: number) => {
    setTripExpenseFiles((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Dois Modais transparentes abertos ao mesmo tempo no iOS costumam roubar toques:
   * o sheet de detalhes ficava “por cima” do de confirmação → “Iniciar embarque” parecia morto.
   * Fechamos o sheet e abrimos só o modal de confirmação; ao voltar, reabrimos o sheet.
   */
  const hideDetailAndOpenConfirmPickup = () => {
    setConfirmCode('');
    setConfirmError('');
    detailSlide.setValue(600);
    setDetailVisible(false);
    confirmSheetSlide.setValue(600);
    setConfirmPickupVisible(true);
    requestAnimationFrame(() => {
      Animated.spring(confirmSheetSlide, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
    });
  };

  const hideDetailAndOpenConfirmDelivery = () => {
    setConfirmCode('');
    setConfirmError('');
    detailSlide.setValue(600);
    setDetailVisible(false);
    confirmSheetSlide.setValue(600);
    setConfirmDeliveryVisible(true);
    requestAnimationFrame(() => {
      Animated.spring(confirmSheetSlide, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
    });
  };

  const dismissConfirmPickupBackToDetail = () => {
    setConfirmCode('');
    setConfirmError('');
    Animated.timing(confirmSheetSlide, { toValue: 600, duration: 250, useNativeDriver: true }).start(() => {
      setConfirmPickupVisible(false);
      setTimeout(() => openDetail(), 320);
    });
  };

  const dismissConfirmDeliveryBackToDetail = () => {
    setConfirmCode('');
    setConfirmError('');
    Animated.timing(confirmSheetSlide, { toValue: 600, duration: 250, useNativeDriver: true }).start(() => {
      setConfirmDeliveryVisible(false);
      setTimeout(() => openDetail(), 320);
    });
  };

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleConfirmStop = async () => {
    if (!currentStop) return;

    try {
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
          const { error } = await supabase
            .from('shipments')
            .update({ picked_up_at: now } as never)
            .eq('id', currentStop.entityId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('shipments')
            .update({ delivered_at: now } as never)
            .eq('id', currentStop.entityId);
          if (error) throw error;
        }
      }

    } catch (e: unknown) {
      showAlert('Erro', getUserErrorMessage(e));
      return;
    }

    // Best-effort em background — await aqui pode deixar o botão “morto” se a rede travar ou RLS demorar.
    if (!currentStop.id.startsWith('booking-') && !currentStop.id.startsWith('shipment-')) {
      void supabase
        .from('trip_stops')
        .update({ status: 'completed' } as never)
        .eq('id', currentStop.id)
        .then(() => {})
        .catch(() => {});
    }

    setConfirmError('');
    setConfirmCode('');
    confirmSheetSlide.setValue(600);
    setConfirmPickupVisible(false);
    setConfirmDeliveryVisible(false);
    syncCloseDetailOnly();
    const next = currentStopIndex + 1;
    setCurrentStopIndex(next);
    if (next >= totalStops) {
      setTimeout(() => openFinalize(), 120);
    }
  };

  /** Fecha o sheet “Viagem concluída” e volta ao tab principal (após avaliação ou fallback). */
  const goHomeFromCompletedRating = useCallback(() => {
    Animated.timing(completedSlide, { toValue: 600, duration: 280, useNativeDriver: true }).start(() => {
      setCompletedVisible(false);
      completedSlide.setValue(600);
      requestAnimationFrame(() => {
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
      });
    });
  }, [navigation, completedSlide]);

  const handleFinalizeTrip = async () => {
    const routeSlotSnapshot = trip;
    setFinalizingTrip(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Sessão inválida. Faça login novamente.');

      const uploadedPaths: string[] = [];
      for (const file of tripExpenseFiles) {
        const res = await fetch(file.uri);
        const blob = await res.blob();
        const rawExt = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : 'jpg';
        const ext = rawExt && /^[a-z0-9]+$/.test(rawExt) ? rawExt : 'jpg';
        const path = `${user.id}/${tripId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('trip-expenses').upload(path, blob, {
          contentType: file.mimeType || 'image/jpeg',
          upsert: false,
        });
        if (upErr) throw upErr;
        uploadedPaths.push(path);
      }

      const updatePayload: Record<string, unknown> = {
        status: 'completed',
        is_active: false,
        driver_journey_started_at: null,
        updated_at: new Date().toISOString(),
      };
      if (uploadedPaths.length > 0) {
        updatePayload.driver_expense_paths = uploadedPaths;
      }
      const { error } = await supabase
        .from('scheduled_trips')
        .update(updatePayload as never)
        .eq('id', tripId)
        .eq('driver_id', user.id);
      if (error) throw error;
      await closeConversationsForScheduledTrip(tripId);

      if (
        routeSlotSnapshot?.route_id &&
        routeSlotSnapshot.day_of_week != null &&
        !Number.isNaN(Number(routeSlotSnapshot.day_of_week))
      ) {
        await insertPlannedRouteSlotAfterComplete(supabase, user.id, {
          route_id: routeSlotSnapshot.route_id,
          day_of_week: Number(routeSlotSnapshot.day_of_week),
          departure_time: routeSlotSnapshot.departure_time ?? null,
          arrival_time: routeSlotSnapshot.arrival_time ?? null,
          capacity: routeSlotSnapshot.capacity ?? 4,
          price_per_person_cents: routeSlotSnapshot.price_per_person_cents ?? 0,
          origin_address: routeSlotSnapshot.origin_address,
          destination_address: routeSlotSnapshot.destination_address,
          origin_lat: routeSlotSnapshot.origin_lat ?? null,
          origin_lng: routeSlotSnapshot.origin_lng ?? null,
          destination_lat: routeSlotSnapshot.destination_lat ?? null,
          destination_lng: routeSlotSnapshot.destination_lng ?? null,
        });
      }
    } catch (e: unknown) {
      showAlert('Erro', getUserErrorMessage(e));
      return;
    } finally {
      setFinalizingTrip(false);
    }
    setTripExpenseFiles([]);
    // Não animar finalize com o modal a desmontar ao abrir o próximo — iOS pode travar toques.
    finalizeSlide.setValue(600);
    setFinalizeVisible(false);
    completedSlide.setValue(600);
    setCompletedVisible(true);
    requestAnimationFrame(() => {
      Animated.spring(completedSlide, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    });
  };

  const handleSubmitRating = async () => {
    if (rating < 1) {
      // Modal nativo: fica acima do bottom sheet (Modal) da viagem concluída; showAlert pode ficar oculto.
      Alert.alert('Avaliação', 'Selecione de 1 a 5 estrelas para enviar.');
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      Alert.alert('Erro', 'Sessão inválida. Faça login novamente.');
      return;
    }
    setSubmittingRating(true);
    try {
      const { error } = await supabase.from('trip_ratings' as never).upsert(
        {
          trip_id: tripId,
          driver_id: user.id,
          rating,
          comment: ratingComment.trim() || null,
        } as never,
        { onConflict: 'trip_id,driver_id' }
      );
      if (error) throw error;
    } catch (e: unknown) {
      if (isTripRatingsUnavailableError(e)) {
        Alert.alert(
          'Avaliação indisponível',
          'O servidor Supabase deste app ainda não tem a tabela de avaliações (trip_ratings). É preciso aplicar as migrações do repositório nesse projeto (por exemplo `supabase db push` ou SQL no painel).\n\nVocê pode ir para o início sem salvar a avaliação.',
          [
            { text: 'Ficar aqui', style: 'cancel' },
            { text: 'Ir para o início', onPress: () => goHomeFromCompletedRating() },
          ],
        );
      } else {
        Alert.alert('Erro', getUserErrorMessage(e));
      }
      return;
    } finally {
      setSubmittingRating(false);
    }
    goHomeFromCompletedRating();
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
        onUserAdjustedMap={() => {
          setFollowMyLocation(false);
          const fix = latestDriverFixRef.current;
          if (
            fix &&
            mapRef.current &&
            isValidGlobeCoordinate(fix.latitude, fix.longitude)
          ) {
            mapRef.current.easeToRegionNorthUp(
              {
                latitude: fix.latitude,
                longitude: fix.longitude,
                latitudeDelta: MY_LOCATION_NAV_DELTA,
                longitudeDelta: MY_LOCATION_NAV_DELTA,
              },
              400,
            );
          }
        }}
      >
        {/* Route from driver to current stop (dark) — oculto no seguir se a rota dourada cobre o trajeto. */}
        {navRoutePresentation.showDark && navRoutePresentation.darkLine.length >= 2 && (
          <MapPolyline id="driver" coordinates={navRoutePresentation.darkLine} strokeColor={DARK} strokeWidth={3} />
        )}

        {/* Rota dourada: no modo seguir, aparada a partir do snap na via. */}
        {navRoutePresentation.showGold && navRoutePresentation.goldLine.length >= 2 && (
          <MapPolyline id="stops" coordinates={navRoutePresentation.goldLine} strokeColor={GOLD} strokeWidth={5} />
        )}

        {/* Fallback: linha reta só entre pontos válidos (nunca 0,0) se Directions/OSRM falharem */}
        {stopsRouteCoords.length < 2 &&
          driverPosition &&
          isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude) &&
          fallbackNavDest && (
          <MapPolyline
            id="fallback"
            coordinates={[
              navRoutePresentation.snappedForFallback ?? driverPosition,
              fallbackNavDest,
            ]}
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

        {/* Pin no mapa só fora do modo navegação (no modo seguir, o puck é fixo na overlay). */}
        {driverPosition && !followMyLocation && (
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

      {followMyLocation &&
        driverPosition &&
        isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude) && (
          <View style={styles.navPuckOverlay} pointerEvents="none">
            <View style={[styles.navPuckAnchor, { top: navPuckTopPx }]}>
              <View style={styles.driverPulse}>
                <View style={styles.driverMarker}>
                  <MaterialIcons name="navigation" size={18} color="#fff" />
                </View>
              </View>
            </View>
          </View>
        )}

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
            onBeforeZoom={() => {
              setFollowMyLocation(false);
              const fix = latestDriverFixRef.current;
              if (
                fix &&
                mapRef.current &&
                isValidGlobeCoordinate(fix.latitude, fix.longitude)
              ) {
                mapRef.current.easeToRegionNorthUp(
                  {
                    latitude: fix.latitude,
                    longitude: fix.longitude,
                    latitudeDelta: MY_LOCATION_NAV_DELTA,
                    longitudeDelta: MY_LOCATION_NAV_DELTA,
                  },
                  280,
                );
              }
            }}
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
        <View style={styles.modalRoot}>
          <Pressable style={styles.overlayBackdrop} onPress={closeDetail} />
          <Animated.View
            style={[styles.detailSheet, styles.sheetAboveBackdrop, { transform: [{ translateY: detailSlide }] }]}
          >
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
                  onPress={hideDetailAndOpenConfirmPickup}
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
                  onPress={hideDetailAndOpenConfirmPickup}
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
                  onPress={hideDetailAndOpenConfirmPickup}
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
                  onPress={hideDetailAndOpenConfirmDelivery}
                  activeOpacity={0.85}
                >
                  <Text style={styles.actionBtnText}>Confirmar entrega</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </Animated.View>
        </View>
      </Modal>

      {/* ── Confirmar coleta / entrega (um bottom sheet, um translateY) ─ */}
      <Modal
        visible={confirmPickupVisible || confirmDeliveryVisible}
        transparent
        animationType="none"
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        statusBarTranslucent={Platform.OS === 'android'}
        onRequestClose={
          confirmDeliveryVisible ? dismissConfirmDeliveryBackToDetail : dismissConfirmPickupBackToDetail
        }
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.overlayBackdrop}
            onPress={
              confirmDeliveryVisible ? dismissConfirmDeliveryBackToDetail : dismissConfirmPickupBackToDetail
            }
          />
          <Animated.View
            style={[
              styles.detailSheet,
              styles.sheetAboveBackdrop,
              { transform: [{ translateY: confirmSheetSlide }] },
            ]}
          >
            <View style={styles.handle} />
            {confirmDeliveryVisible ? (
              <>
                <View style={styles.confirmSheetHeaderRow}>
                  <Text style={styles.confirmSheetTitle} numberOfLines={2}>
                    Confirmar entrega
                  </Text>
                  <TouchableOpacity
                    style={styles.iconCircleBtn}
                    onPress={dismissConfirmDeliveryBackToDetail}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="close" size={20} color={DARK} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.confirmSheetSubtitle}>
                  Insira o código informado pelo cliente para confirmar a entrega.
                </Text>
                <View style={styles.confirmSheetDivider} />
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
                  placeholder="Ex: 1234"
                  placeholderTextColor="#9CA3AF"
                  textAlign="center"
                />
                {confirmError ? <Text style={styles.errorText}>{confirmError}</Text> : null}
                <TouchableOpacity style={styles.actionBtn} onPress={handleConfirmStop} activeOpacity={0.85}>
                  <Text style={styles.actionBtnText}>Confirmar entrega</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sheetBackBtn}
                  onPress={dismissConfirmDeliveryBackToDetail}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Voltar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.confirmSheetHeaderRow}>
                  <Text style={styles.confirmSheetTitle} numberOfLines={2}>
                    {confirmPickupTitle(currentStop)}
                  </Text>
                  <TouchableOpacity
                    style={styles.iconCircleBtn}
                    onPress={dismissConfirmPickupBackToDetail}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="close" size={20} color={DARK} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.confirmSheetSubtitle}>{confirmPickupSubtitle(currentStop)}</Text>
                <View style={styles.confirmSheetDivider} />
                {currentStop && isPackage(currentStop) ? (
                  <>
                    <Text style={styles.fieldLabel}>
                      {currentStop.stopType === 'package_pickup' ? 'Código de coleta' : 'Código'}
                    </Text>
                    <TextInput
                      style={styles.codeInput}
                      value={confirmCode}
                      onChangeText={(v) => {
                        setConfirmCode(v.replace(/\D/g, '').slice(0, 4));
                        setConfirmError('');
                      }}
                      keyboardType="numeric"
                      maxLength={4}
                      placeholder="Ex: 1234"
                      placeholderTextColor="#9CA3AF"
                      textAlign="center"
                    />
                  </>
                ) : null}
                {confirmError ? <Text style={styles.errorText}>{confirmError}</Text> : null}
                <TouchableOpacity style={styles.actionBtn} onPress={handleConfirmStop} activeOpacity={0.85}>
                  <Text style={styles.actionBtnText}>{confirmPickupButtonLabel(currentStop)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sheetBackBtn}
                  onPress={dismissConfirmPickupBackToDetail}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Voltar</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* ── Finalize Trip sheet ─────────────────────────────── */}
      <Modal visible={finalizeVisible} transparent animationType="none" onRequestClose={closeFinalize}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.overlayBackdrop} onPress={closeFinalize} />
          <Animated.View
            style={[styles.detailSheet, styles.sheetAboveBackdrop, { transform: [{ translateY: finalizeSlide }] }]}
          >
          <View style={styles.handle} />
          <View style={styles.finalizeTopRow}>
            <TouchableOpacity style={styles.iconCircleBtn} onPress={closeFinalize} activeOpacity={0.7}>
              <MaterialIcons name="close" size={20} color={DARK} />
            </TouchableOpacity>
            <Text style={styles.detailTitle}>Finalizar viagem</Text>
            <View style={styles.iconCircleBtn} />
          </View>

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
              <Text style={styles.finalizeSummaryValue}>{tripDistanceApproxLabel}</Text>
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

          <Text style={styles.expenseOptional}>Anexar despesas (opcional)</Text>
          <TouchableOpacity
            style={[styles.expenseBox, tripExpenseFiles.length > 0 && styles.expenseBoxAttached]}
            onPress={() => void handlePickTripExpenses()}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="add-photo-alternate"
              size={26}
              color={tripExpenseFiles.length > 0 ? GOLD : '#9CA3AF'}
            />
            <View style={styles.expenseTextCol}>
              <Text style={[styles.expenseText, tripExpenseFiles.length > 0 && { color: DARK, fontWeight: '600' }]}>
                Toque para escolher fotos dos comprovantes
              </Text>
              <Text style={styles.expenseHint}>Até 8 imagens (galeria)</Text>
            </View>
          </TouchableOpacity>
          {tripExpenseFiles.length > 0 ? (
            <View style={styles.expenseThumbsRow}>
              {tripExpenseFiles.map((f, idx) => (
                <View key={`${f.uri}-${idx}`} style={styles.expenseThumbWrap}>
                  <Image source={{ uri: f.uri }} style={styles.expenseThumbImg} />
                  <TouchableOpacity
                    style={styles.expenseThumbRemove}
                    onPress={() => removeTripExpenseAt(idx)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialIcons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnFullWidth, finalizingTrip && { opacity: 0.6 }]}
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
        </View>
      </Modal>

      {/* ── Viagem concluída + avaliação (bottom sheet sobre o mapa) ─ */}
      <Modal
        visible={completedVisible}
        transparent
        animationType="none"
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        statusBarTranslucent={Platform.OS === 'android'}
        onRequestClose={() => {}}
      >
        <View style={styles.modalRoot}>
          <View style={styles.overlayBackdrop} />
          <Animated.View
            style={[
              styles.completedBottomSheet,
              styles.sheetAboveBackdrop,
              {
                transform: [{ translateY: completedSlide }],
                paddingBottom: Math.max(insets.bottom, 16) + 16,
              },
            ]}
          >
            <View style={styles.handle} />
            <ScrollView
              contentContainerStyle={styles.completedScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
            >
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
                  <Text style={styles.completedStatValue}>{tripDistanceApproxLabel}</Text>
                  <Text style={styles.completedStatLabel}>Distância percorrida</Text>
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

              <View style={styles.commentLabelRow}>
                <Text style={[styles.fieldLabel, styles.commentFieldLabel]}>Comentário</Text>
                <Text style={styles.commentOptionalTag}>Opcional</Text>
              </View>
              <TextInput
                style={styles.commentInput}
                value={ratingComment}
                onChangeText={setRatingComment}
                placeholder="Descreva algum comentário sobre a entrega..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnFullWidth, submittingRating && { opacity: 0.6 }]}
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
          </Animated.View>
        </View>
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
  navPuckOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  navPuckAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },

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

  // ── Modal root (evita hit-test errado entre overlay e sheet no iOS) ──
  modalRoot: {
    flex: 1,
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 0,
  },
  sheetAboveBackdrop: {
    zIndex: 1,
    elevation: 40,
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
  /** Em ScrollView com `alignItems: 'center'`, força o botão à largura útil do sheet. */
  actionBtnFullWidth: { alignSelf: 'stretch', width: '100%' },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelBtnText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },

  confirmSheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  confirmSheetTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: DARK,
    lineHeight: 24,
  },
  confirmSheetSubtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 16 },
  confirmSheetDivider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 16 },
  sheetBackBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#F3F4F6',
  },

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
  expenseTextCol: { flex: 1, gap: 4, minWidth: 0 },
  expenseHint: { fontSize: 12, color: '#9CA3AF' },
  expenseThumbsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
    marginTop: 4,
  },
  expenseThumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  expenseThumbImg: { width: '100%', height: '100%' },
  expenseThumbRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseOptional: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 4,
  },

  finalizeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  // ── Viagem concluída (bottom sheet) ───────────────────────
  completedBottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 8,
    maxHeight: '88%',
  },
  completedScroll: { paddingBottom: 24, paddingTop: 16, alignItems: 'center' },
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
  commentLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
    marginTop: 4,
  },
  commentFieldLabel: { marginTop: 0, marginBottom: 0 },
  commentOptionalTag: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
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
