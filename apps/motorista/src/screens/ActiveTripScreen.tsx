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
  type GoogleMapsMapRef,
  type LatLng,
  type MapRegion,
  regionFromLatLngPoints,
  isValidGlobeCoordinate,
  latLngFromDbColumns,
} from '../components/googleMaps';
import { supabase } from '../lib/supabase';
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

type TripRow = {
  id: string;
  origin_address: string;
  destination_address: string;
  departure_at: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  amount_cents: number;
  status: string;
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

function formatFullRouteLabel(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—';
  return formatEta(seconds);
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

/** Paradas com coordenada válida a partir do índice atual (embarque do passageiro antes do desembarque, na ordem do roteiro). */
function remainingStopLatLngs(stops: Stop[], fromIndex: number): LatLng[] {
  const pts: LatLng[] = [];
  for (let i = Math.max(0, fromIndex); i < stops.length; i++) {
    const s = stops[i];
    if (s.lat != null && s.lng != null && isValidGlobeCoordinate(s.lat, s.lng)) {
      pts.push({ latitude: s.lat, longitude: s.lng });
    }
  }
  return dedupeConsecutivePoints(pts);
}

function appendTripDestinationIfNeeded(pts: LatLng[], tdest: LatLng | undefined): LatLng[] {
  if (!tdest) return pts;
  const last = pts[pts.length - 1];
  if (
    last &&
    Math.abs(last.latitude - tdest.latitude) < 1e-5 &&
    Math.abs(last.longitude - tdest.longitude) < 1e-5
  ) {
    return pts;
  }
  return dedupeConsecutivePoints([...pts, tdest]);
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
  /** Duração estimada da rota completa (paradas + destino linha), Directions/Mapbox. */
  const [fullRouteDurationSeconds, setFullRouteDurationSeconds] = useState<number | null>(null);

  // Driver position
  const [driverPosition, setDriverPosition] = useState<LatLng | null>(null);
  const locationSub = useRef<any>(null);
  const mapRef = useRef<GoogleMapsMapRef>(null);
  const hasFramedDriverOnMap = useRef(false);
  const locationPermissionWarned = useRef(false);
  const locationModuleWarned = useRef(false);

  // UI state
  const [detailVisible, setDetailVisible] = useState(false);
  const [confirmPickupVisible, setConfirmPickupVisible] = useState(false);
  const [confirmDeliveryVisible, setConfirmDeliveryVisible] = useState(false);
  const [finalizeVisible, setFinalizeVisible] = useState(false);
  const [completedVisible, setCompletedVisible] = useState(false);
  /** Confirmação antes de abrir a folha de finalização (mesmo fluxo da Home). */
  const [exitConfirmVisible, setExitConfirmVisible] = useState(false);

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
        .select('id, origin_address, destination_address, departure_at, origin_lat, origin_lng, destination_lat, destination_lng, amount_cents, status')
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
  /** Todas as paradas do roteiro concluídas (ou não há paradas numeradas). */
  const stopsLegComplete = totalStops > 0 && currentStopIndex >= totalStops;
  const allDone = stopsLegComplete;

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

  const tripOriginLL = useMemo(
    () => (trip ? pickStopCoord(trip.origin_lat, trip.origin_lng) : undefined),
    [trip?.origin_lat, trip?.origin_lng, trip?.id],
  );
  const tripDestLL = useMemo(
    () => (trip ? pickStopCoord(trip.destination_lat, trip.destination_lng) : undefined),
    [trip?.destination_lat, trip?.destination_lng, trip?.id],
  );

  /**
   * Rota dourada: sempre a partir da posição atual do motorista quando houver GPS —
   * depois as paradas restantes em ordem (ex.: embarcar passageiro primeiro),
   * e por fim o destino da viagem agendada se não for duplicado.
   * Sem GPS, mostra só o trecho restante entre paradas (sem fingir sair da origem da oferta).
   */
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const routeOpts = { mapboxToken: getMapboxAccessToken(), googleMapsApiKey: getGoogleMapsApiKey() };

    const tdest = trip ? pickStopCoord(trip.destination_lat, trip.destination_lng) : undefined;
    const remaining = remainingStopLatLngs(stops, currentStopIndex);
    let waypointChain = appendTripDestinationIfNeeded(remaining, tdest);
    if (stops.length === 0 && tdest) {
      waypointChain = [tdest];
    }

    const hasDriver =
      driverPosition != null &&
      isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude);

    (async () => {
      const applyRoute = (r: { coordinates: LatLng[]; durationSeconds: number } | null) => {
        if (cancelled || !r?.coordinates?.length) return false;
        setStopsRouteCoords(r.coordinates);
        if (r.durationSeconds > 0) setFullRouteDurationSeconds(r.durationSeconds);
        else setFullRouteDurationSeconds(null);
        return true;
      };

      if (hasDriver && waypointChain.length >= 1) {
        const fromDriver = dedupeConsecutivePoints([driverPosition!, ...waypointChain]);
        if (fromDriver.length >= 2) {
          const r = await getMultiPointRoute(fromDriver, routeOpts);
          if (applyRoute(r)) return;
        }
        const r = await getRouteWithDuration(driverPosition!, waypointChain[0]!, routeOpts);
        if (applyRoute(r)) return;
      }

      if (waypointChain.length >= 2) {
        const r = await getMultiPointRoute(waypointChain, routeOpts);
        if (applyRoute(r)) return;
      }

      if (hasDriver && waypointChain.length === 0 && finalDestination) {
        const r = await getRouteWithDuration(driverPosition!, finalDestination, routeOpts);
        if (applyRoute(r)) return;
      }

      if (!hasDriver && tripOriginLL && tripDestLL && waypointChain.length === 0) {
        const r = await getRouteWithDuration(tripOriginLL, tripDestLL, routeOpts);
        if (applyRoute(r)) return;
      }

      if (!cancelled) {
        setStopsRouteCoords([]);
        setFullRouteDurationSeconds(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    stops,
    currentStopIndex,
    finalDestination,
    driverPositionKey,
    trip?.destination_lat,
    trip?.destination_lng,
    trip?.origin_lat,
    trip?.origin_lng,
    trip?.id,
    tripOriginLL,
    tripDestLL,
  ]);

  // Trecho escuro: GPS → parada atual (ou → destino final se não houver paradas com coordenada).
  useEffect(() => {
    if (
      !driverPosition ||
      !isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude)
    ) {
      return;
    }

    const dest: LatLng | null = (() => {
      if (stops.length > 0) {
        const stop = stops[currentStopIndex];
        if (
          stop?.lat != null &&
          stop?.lng != null &&
          isValidGlobeCoordinate(stop.lat, stop.lng)
        ) {
          return { latitude: stop.lat, longitude: stop.lng };
        }
        return null;
      }
      return finalDestination;
    })();

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

  // Região inicial estática — centrada na origem com zoom de rua.
  // Não depende de driverPosition para evitar que updates de GPS resetem a câmera.
  const mapInitialRegion = useMemo((): MapRegion => {
    if (tripOriginLL) {
      return {
        latitude: tripOriginLL.latitude,
        longitude: tripOriginLL.longitude,
        latitudeDelta: 0.002,
        longitudeDelta: 0.002,
      };
    }
    const pts: LatLng[] = [];
    for (const s of stops) {
      if (s.lat != null && s.lng != null && isValidGlobeCoordinate(s.lat, s.lng)) {
        pts.push({ latitude: s.lat, longitude: s.lng });
      }
    }
    if (tripDestLL) pts.push(tripDestLL);
    return regionFromLatLngPoints(pts);
  }, [trip?.id, tripOriginLL?.latitude, tripOriginLL?.longitude]);

  /** Sem GPS e sem nenhuma coordenada de viagem/paradas → não confundir com mapa “real” centrado no BR. */
  const activeTripMapReady = useMemo(() => {
    if (loading) return true;
    if (
      driverPosition &&
      isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude)
    )
      return true;
    if (tripOriginLL || tripDestLL) return true;
    return stops.some(
      (s) =>
        s.lat != null &&
        s.lng != null &&
        isValidGlobeCoordinate(s.lat, s.lng),
    );
  }, [loading, driverPosition, tripOriginLL, tripDestLL, stops]);

  // Primeira posição GPS: centraliza no motorista com zoom 16.
  useEffect(() => {
    if (loading || !driverPosition || hasFramedDriverOnMap.current) return;
    if (!isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude)) return;
    const id = requestAnimationFrame(() => {
      mapRef.current?.animateToRegion(
        { latitude: driverPosition.latitude, longitude: driverPosition.longitude, latitudeDelta: 0.002, longitudeDelta: 0.002 },
        500,
      );
    });
    hasFramedDriverOnMap.current = true;
    return () => cancelAnimationFrame(id);
  }, [loading, driverPosition]);

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
        {stopsRouteCoords.length < 2 && tripOriginLL && tripDestLL && (
          <MapPolyline
            id="fallback"
            coordinates={[tripOriginLL, tripDestLL]}
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
                {isCompleted ? (
                  <MaterialIcons name="check" size={18} color="#fff" />
                ) : isPassenger(stop) ? (
                  <MaterialIcons name="person" size={18} color="#fff" />
                ) : (
                  <MaterialIcons name="inventory-2" size={18} color="#fff" />
                )}
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

      {/* ── Overlay UI: voltar flutuante + controlos sobre o mapa (sem faixa branca) ── */}
      <SafeAreaView
        edges={['top', 'bottom']}
        style={[styles.overlayRoot, { paddingBottom: insets.bottom > 0 ? 0 : 8 }]}
        pointerEvents="box-none"
      >
        <View style={styles.overlayBody} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.backBtnFloat}
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <MaterialIcons name="arrow-back" size={22} color={DARK} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.myLocationBtn}
            activeOpacity={0.8}
            onPress={() => {
              if (!driverPosition || !isValidGlobeCoordinate(driverPosition.latitude, driverPosition.longitude)) return;
              mapRef.current?.animateToRegion(
                { latitude: driverPosition.latitude, longitude: driverPosition.longitude, latitudeDelta: 0.002, longitudeDelta: 0.002 },
                400,
              );
            }}
          >
            <MaterialIcons name="my-location" size={22} color={DARK} />
          </TouchableOpacity>

        {(stops.length > 0 || tripDestLL) && (
          <View style={styles.sidebar}>
            {/* Linha conectora atrás dos botões */}
            {(stops.length + (tripDestLL ? 1 : 0)) > 1 && (
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
                  onPress={() => { if (idx === currentStopIndex) openDetail(); }}
                  activeOpacity={0.8}
                >
                  {isCompleted ? (
                    <MaterialIcons name="check" size={18} color={iconColor} />
                  ) : isPassenger(stop) ? (
                    <MaterialIcons name="person" size={18} color={iconColor} />
                  ) : (
                    <MaterialIcons name="inventory-2" size={18} color={iconColor} />
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Ponto final: destino da viagem */}
            {tripDestLL && (
              <View style={[styles.sidebarBtn, styles.sidebarDestBtn]}>
                <MaterialIcons name="flag" size={18} color={DARK} />
              </View>
            )}
          </View>
        )}

        {cardInfo && !detailVisible && !allDone && (
          <View style={styles.miniSheet} pointerEvents="auto">
            <TouchableOpacity
              activeOpacity={currentStop ? 0.92 : 1}
              onPress={() => { if (currentStop) openDetail(); }}
              disabled={!currentStop}
            >
              <View style={styles.miniSheetTopRow}>
                <View style={[
                  styles.stopTypePill,
                  isPassenger(cardInfo) && styles.stopTypePillTrip,
                ]}>
                  <View style={styles.stopTypeDot} />
                  <Text style={styles.stopTypePillText}>
                    {isPassenger(cardInfo)
                      ? 'Viagem'
                      : isPickup(cardInfo) ? 'Coleta' : 'Entrega'}
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

              {fullRouteDurationSeconds != null && fullRouteDurationSeconds > 0 && (
                <View style={styles.fullRouteRow}>
                  <MaterialIcons name="route" size={14} color="#6B7280" />
                  <Text style={styles.fullRouteText} numberOfLines={1}>
                    Rota completa: {formatEta(fullRouteDurationSeconds)}
                  </Text>
                </View>
              )}

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

              {currentStop ? (
                <Text style={styles.miniSheetTapHint}>Toque para ver detalhes da parada</Text>
              ) : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.miniEndTripBtn}
              onPress={() => setExitConfirmVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.miniEndTripBtnText}>Encerrar viagem</Text>
            </TouchableOpacity>
          </View>
        )}

        {allDone && !finalizeVisible && !completedVisible && (
          <TouchableOpacity
            style={styles.finalizeFloatBtn}
            onPress={() => setExitConfirmVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.finalizeFloatBtnText}>Finalizar viagem</Text>
          </TouchableOpacity>
        )}
        </View>
      </SafeAreaView>

      <Modal
        visible={exitConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExitConfirmVisible(false)}
      >
        <View style={styles.exitModalRoot}>
          <TouchableOpacity
            style={styles.exitModalBackdrop}
            activeOpacity={1}
            onPress={() => setExitConfirmVisible(false)}
          />
          <View style={styles.exitModalCard}>
            <View style={styles.exitModalIconWrap}>
              <MaterialIcons name="flag" size={32} color={DARK} />
            </View>
            <Text style={styles.exitModalTitle}>Encerrar viagem?</Text>
            <Text style={styles.exitModalBody}>
              Ao continuar, você confirma o encerramento desta corrida e poderá enviar o resumo e marcar a viagem como concluída.
            </Text>
            <TouchableOpacity
              style={styles.exitModalBtnConfirm}
              onPress={() => {
                setExitConfirmVisible(false);
                openFinalize();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.exitModalBtnConfirmText}>Continuar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exitModalBtnCancel}
              onPress={() => setExitConfirmVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.exitModalBtnCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
              {currentStop && isPickup(currentStop) ? 'Detalhes da coleta' : `Entrega para ${currentStop?.label ?? ''}`}
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
                <Text style={styles.detailLabel}>Endereço da coleta</Text>
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
                  <Text style={styles.actionBtnText}>Iniciar coleta</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>Cancelar coleta</Text>
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
            <Text style={styles.centeredModalTitle}>Confirmar coleta</Text>
            <Text style={styles.centeredModalSubtitle}>
              {currentStop && isPackage(currentStop)
                ? 'Insira o código de 4 dígitos informado pelo remetente.'
                : 'Confirme a coleta do passageiro.'}
            </Text>
            {currentStop && isPackage(currentStop) && (
              <>
                <Text style={styles.fieldLabel}>Código de coleta</Text>
                <TextInput
                  style={styles.codeInput}
                  value={confirmCode}
                  onChangeText={(v) => { setConfirmCode(v.replace(/\D/g, '').slice(0, 4)); setConfirmError(''); }}
                  keyboardType="numeric"
                  maxLength={4}
                  placeholder="0000"
                  placeholderTextColor="#9CA3AF"
                  textAlign="center"
                />
              </>
            )}
            {confirmError ? <Text style={styles.errorText}>{confirmError}</Text> : null}
            <TouchableOpacity style={styles.actionBtn} onPress={handleConfirmStop} activeOpacity={0.85}>
              <Text style={styles.actionBtnText}>Confirmar coleta</Text>
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
              placeholder="0000"
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
              <Text style={styles.finalizeSummaryLabel}>Tempo total (rota)</Text>
              <Text style={styles.finalizeSummaryValue}>
                {formatFullRouteLabel(fullRouteDurationSeconds)}
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
                  {formatFullRouteLabel(fullRouteDurationSeconds)}
                </Text>
                <Text style={styles.completedStatLabel}>Tempo estimado (rota)</Text>
              </View>
              <View style={styles.completedStatDivider} />
              <View style={styles.completedStatItem}>
                <Text style={styles.completedStatValue}>{totalStops}</Text>
                <Text style={styles.completedStatLabel}>Paradas</Text>
              </View>
              <View style={styles.completedStatDivider} />
              <View style={styles.completedStatItem}>
                <Text style={styles.completedStatValue}>
                  {trip?.amount_cents
                    ? `R$ ${(trip.amount_cents / 100).toFixed(2).replace('.', ',')}`
                    : '—'}
                </Text>
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

  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: Platform.OS === 'android' ? 12 : 0,
  },
  overlayBody: { flex: 1, position: 'relative' },
  backBtnFloat: {
    position: 'absolute',
    left: 14,
    top: 10,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 5,
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
  myLocationBtn: {
    position: 'absolute',
    left: 14,
    top: 66,
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
    right: 14,
    top: 66,
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
  fullRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  fullRouteText: {
    fontSize: 13,
    color: DARK,
    fontWeight: '600',
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
  miniSheetTapHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 10,
    textAlign: 'center',
  },
  miniEndTripBtn: {
    marginTop: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  miniEndTripBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
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

  exitModalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  exitModalBackdrop: { ...StyleSheet.absoluteFillObject },
  exitModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    alignItems: 'center',
  },
  exitModalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  exitModalTitle: { fontSize: 20, fontWeight: '700', color: DARK, marginBottom: 10 },
  exitModalBody: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 28,
  },
  exitModalBtnConfirm: {
    width: '100%',
    backgroundColor: DARK,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  exitModalBtnConfirmText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  exitModalBtnCancel: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  exitModalBtnCancelText: { fontSize: 16, fontWeight: '600', color: '#374151' },

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
