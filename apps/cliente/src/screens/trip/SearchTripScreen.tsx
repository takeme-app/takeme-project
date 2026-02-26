import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, Dimensions, PanResponder, Modal, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { getCurrentPlace, requestLocationPermission, getCurrentPosition } from '../../lib/location';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import { DriverMarkerIcon } from '../../components/DriverMarkerIcon';
import { MyLocationMarkerIcon } from '../../components/MyLocationMarkerIcon';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripStackParamList, TripDriverParam } from '../../navigation/types';
import { getRecentDestinations, addRecentDestination, type RecentDestination } from '../../lib/recentDestinations';
import { getRoutePolyline, type RoutePoint } from '../../lib/route';
import { supabase } from '../../lib/supabase';

type Place = { address: string; latitude: number; longitude: number };

/** Raio em graus para considerar origem/destino "próximos" (~15 km) */
const ROUTE_MATCH_DEGREES = 0.15;

/** Item de viagem agendada no formato da lista (motorista, horários, assentos, malas) */
export type ScheduledTripItem = {
  id: string;
  title: string;
  driverName: string;
  driverAvatarUrl: string | null;
  rating: number;
  badge: string;
  departure: string;
  arrival: string;
  seats: number;
  bags: number;
  latitude: number;
  longitude: number;
  origin_lat: number;
  origin_lng: number;
  amount_cents: number | null;
  /** ISO string para filtrar por data/hora (ex.: PlanRide) */
  departure_at?: string;
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HIDDEN_OFFSET = SCREEN_HEIGHT;
const EDIT_SHEET_SLIDE = 400;

type Props = NativeStackScreenProps<TripStackParamList, 'SearchTrip'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toTimeString().slice(0, 5);
}

/** Iniciais do nome: "Diego Barbosa" -> "DB", "Maria" -> "MA". */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Distância em km entre dois pontos (Haversine). Retorna null se coords inválidas. */
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
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Formata distância para exibição: "1.1 km", "2.3 km". */
function formatDistanceKm(km: number): string {
  if (km < 1) return `${(km * 1000).toFixed(0)} m`;
  return `${km.toFixed(1)} km`;
}

const DEFAULT_REGION = {
  latitude: -7.3289,
  longitude: -35.3328,
  latitudeDelta: 0.008,
  longitudeDelta: 0.008,
};

const PLACEHOLDER_ORIGIN: Place = {
  address: 'Obtendo sua localização...',
  latitude: DEFAULT_REGION.latitude,
  longitude: DEFAULT_REGION.longitude,
};
const FALLBACK_ORIGIN: Place = {
  address: 'Permita acesso à localização',
  latitude: DEFAULT_REGION.latitude,
  longitude: DEFAULT_REGION.longitude,
};
const DEFAULT_DESTINATION_COORDS = { latitude: -7.3305, longitude: -35.3335 };

/** Em "Planeje sua corrida" (imediata) mostramos mais endereços recentes; em "Procurando viagem" só 2. */
const RECENT_LIST_SIZE_DEFAULT = 2;
const RECENT_LIST_SIZE_PLAN = 10;

export function SearchTripScreen({ navigation, route }: Props) {
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const [sheetVisible, setSheetVisible] = useState(true);
  const [origin, setOrigin] = useState<Place>(PLACEHOLDER_ORIGIN);
  const [destination, setDestination] = useState<Place | null>(() => {
    const dest = route.params?.destination;
    if (!dest) return null;
    return {
      address: dest.address,
      latitude: dest.latitude ?? DEFAULT_DESTINATION_COORDS.latitude,
      longitude: dest.longitude ?? DEFAULT_DESTINATION_COORDS.longitude,
    };
  });
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editOrigin, setEditOrigin] = useState(origin.address);
  const [editDestination, setEditDestination] = useState(destination?.address ?? '');
  const [locationLoading, setLocationLoading] = useState(false);
  const [mapCentering, setMapCentering] = useState(false);
  const [userLocationCoords, setUserLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [recentDestinations, setRecentDestinations] = useState<RecentDestination[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [allScheduledTrips, setAllScheduledTrips] = useState<ScheduledTripItem[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [planWhenModalVisible, setPlanWhenModalVisible] = useState(false);

  /** Lista filtrada por origem/destino quando ambos estão definidos (ex.: Itabaiana → João Pessoa; Itabaiana → Recife não mostra as de João Pessoa). */
  const scheduledTrips = useMemo(() => {
    if (!origin?.latitude || !destination?.latitude) return allScheduledTrips;
    const oLat = origin.latitude;
    const oLng = origin.longitude;
    const dLat = destination.latitude;
    const dLng = destination.longitude;
    return allScheduledTrips.filter(
      (t) =>
        Math.abs(t.origin_lat - oLat) <= ROUTE_MATCH_DEGREES &&
        Math.abs(t.origin_lng - oLng) <= ROUTE_MATCH_DEGREES &&
        Math.abs(t.latitude - dLat) <= ROUTE_MATCH_DEGREES &&
        Math.abs(t.longitude - dLng) <= ROUTE_MATCH_DEGREES
    );
  }, [allScheduledTrips, origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude]);

  /** Endereços recentes ordenados pela menor distância da origem (para a página Planeje sua corrida). */
  const sortedRecentDestinationsForPlan = useMemo(() => {
    return [...recentDestinations]
      .map((item) => ({
        item,
        distKm: distanceKm(origin.latitude, origin.longitude, item.latitude, item.longitude),
      }))
      .sort((a, b) => {
        const da = a.distKm ?? Infinity;
        const db = b.distKm ?? Infinity;
        return da - db;
      })
      .map(({ item }) => item)
      .slice(0, RECENT_LIST_SIZE_PLAN);
  }, [recentDestinations, origin.latitude, origin.longitude]);

  const [markersTrackView, setMarkersTrackView] = useState(true);
  const [routeCoords, setRouteCoords] = useState<RoutePoint[] | null>(null);
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const lastTranslateY = useRef(0);
  const editOverlayOpacity = useRef(new Animated.Value(0)).current;
  const editSheetTranslateY = useRef(new Animated.Value(EDIT_SHEET_SLIDE)).current;

  const initialSheetHeight = Math.max(320, SCREEN_HEIGHT * 0.7);
  const maxSheetHeight = SCREEN_HEIGHT - insets.top;
  const scrollGrowthDistance = 280;
  const [sheetHeightState, setSheetHeightState] = useState(initialSheetHeight);

  const handleSheetScroll = useMemo(
    () =>
      ({ nativeEvent }: { nativeEvent: { contentOffset: { y: number } } }) => {
        const y = nativeEvent.contentOffset.y;
        const t = Math.min(1, Math.max(0, y / scrollGrowthDistance));
        const height = Math.round(initialSheetHeight + t * (maxSheetHeight - initialSheetHeight));
        setSheetHeightState(height);
      },
    [initialSheetHeight, maxSheetHeight, scrollGrowthDistance]
  );

  useEffect(() => {
    let cancelled = false;
    getCurrentPlace().then((place) => {
      if (cancelled) return;
      if (place) {
        setOrigin({ address: place.address, latitude: place.latitude, longitude: place.longitude });
        setUserLocationCoords({ latitude: place.latitude, longitude: place.longitude });
      } else {
        setOrigin(FALLBACK_ORIGIN);
      }
    }).catch(() => {
      if (!cancelled) setOrigin(FALLBACK_ORIGIN);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!userLocationCoords) return;
    const t = setTimeout(() => {
      mapRef.current?.animateToRegion(
        {
          latitude: userLocationCoords.latitude,
          longitude: userLocationCoords.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        400
      );
    }, 300);
    return () => clearTimeout(t);
  }, [userLocationCoords]);

  const loadRecentDestinations = useCallback(() => {
    getRecentDestinations().then(setRecentDestinations);
  }, []);

  useFocusEffect(loadRecentDestinations);

  useEffect(() => {
    let cancelled = false;
    setTripsLoading(true);
    setTripsError(null);
    (async () => {
      const { data: trips, error: tripsErr } = await supabase
        .from('scheduled_trips')
        .select('id, title, driver_id, origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng, departure_at, arrival_at, seats_available, bags_available, badge, amount_cents')
        .eq('status', 'active')
        .order('departure_at');
      if (cancelled) return;
      if (tripsErr) {
        setTripsError(tripsErr.message);
        setAllScheduledTrips([]);
        setTripsLoading(false);
        return;
      }
      if (!trips?.length) {
        setAllScheduledTrips([]);
        setTripsLoading(false);
        return;
      }
      const driverIds = [...new Set(trips.map((t) => t.driver_id))];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, rating, avatar_url').in('id', driverIds);
      if (cancelled) return;
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const items: ScheduledTripItem[] = trips.map((t) => ({
        id: t.id,
        title: t.title ?? `${t.origin_address} → ${t.destination_address}`,
        driverName: profileMap.get(t.driver_id)?.full_name ?? 'Motorista',
        driverAvatarUrl: profileMap.get(t.driver_id)?.avatar_url ?? null,
        rating: Number(profileMap.get(t.driver_id)?.rating ?? 0),
        badge: t.badge ?? 'Take Me',
        departure: formatTime(t.departure_at),
        arrival: formatTime(t.arrival_at),
        seats: t.seats_available,
        bags: t.bags_available,
        latitude: t.destination_lat,
        longitude: t.destination_lng,
        origin_lat: t.origin_lat,
        origin_lng: t.origin_lng,
        amount_cents: t.amount_cents ?? null,
        departure_at: t.departure_at,
      }));
      setAllScheduledTrips(items);
      setTripsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMarkersTrackView(false), 1000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const dest = route.params?.destination;
    if (dest) {
      setDestination({
        address: dest.address,
        latitude: dest.latitude ?? DEFAULT_DESTINATION_COORDS.latitude,
        longitude: dest.longitude ?? DEFAULT_DESTINATION_COORDS.longitude,
      });
    }
  }, [route.params?.destination?.address]);

  useEffect(() => {
    if (!destination) {
      setRouteCoords(null);
      return;
    }
    let cancelled = false;
    getRoutePolyline(
      { latitude: origin.latitude, longitude: origin.longitude },
      { latitude: destination.latitude, longitude: destination.longitude }
    ).then((coords) => {
      if (!cancelled && coords?.length) setRouteCoords(coords);
      else if (!cancelled) setRouteCoords(null);
    });
    return () => { cancelled = true; };
  }, [origin.latitude, origin.longitude, destination?.latitude, destination?.longitude]);

  useEffect(() => {
    setEditOrigin(origin.address);
    setEditDestination(destination?.address ?? '');
  }, [origin.address, destination?.address]);

  useEffect(() => {
    if (!editModalVisible) return;
    Animated.sequence([
      Animated.timing(editOverlayOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(editSheetTranslateY, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [editModalVisible]);

  const openEditModal = () => {
    setEditOrigin(origin.address);
    setEditDestination(destination?.address ?? '');
    editOverlayOpacity.setValue(0);
    editSheetTranslateY.setValue(EDIT_SHEET_SLIDE);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setEditModalVisible(true);
      });
    });
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
  };

  const centerMapOnMyLocation = async () => {
    setMapCentering(true);
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        Alert.alert('Localização', 'Ative a localização nas configurações para centralizar o mapa.');
        return;
      }
      const coords = await getCurrentPosition();
      mapRef.current?.animateToRegion(
        {
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        400
      );
    } catch {
      Alert.alert('Localização', 'Não foi possível obter sua posição.');
    } finally {
      setMapCentering(false);
    }
  };

  const useMyLocationForOrigin = async () => {
    setLocationLoading(true);
    try {
      const place = await getCurrentPlace();
      if (place) {
        setOrigin({ address: place.address, latitude: place.latitude, longitude: place.longitude });
        setEditOrigin(place.address);
        setUserLocationCoords({ latitude: place.latitude, longitude: place.longitude });
      } else {
        Alert.alert('Localização', 'Não foi possível usar sua localização. Verifique se o app tem permissão nas configurações.');
      }
    } catch {
      Alert.alert('Localização', 'Não foi possível obter seu endereço. Tente novamente.');
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
      addRecentDestination({ address: destText, city, latitude: lat, longitude: lng }).then(() => {
        loadRecentDestinations();
      });
    } else {
      setDestination(null);
    }
    closeEditModal();
  };

  const snapTo = (toValue: number, onHidden?: () => void) => {
    Animated.timing(sheetTranslateY, {
      toValue,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      lastTranslateY.current = toValue;
      if (toValue >= SHEET_HIDDEN_OFFSET) onHidden?.();
    });
  };

  const showSheet = () => {
    setSheetVisible(true);
    lastTranslateY.current = SHEET_HIDDEN_OFFSET;
    Animated.timing(sheetTranslateY, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start(() => {
      lastTranslateY.current = 0;
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
        onPanResponderMove: (_, g) => {
          const next = lastTranslateY.current + g.dy;
          const clamped = Math.max(0, Math.min(SHEET_HIDDEN_OFFSET, next));
          sheetTranslateY.setValue(clamped);
        },
        onPanResponderRelease: (_, g) => {
          const current = lastTranslateY.current + g.dy;
          const velocity = g.vy;
          const mid = SHEET_HIDDEN_OFFSET / 2;
          const shouldCollapse =
            velocity > 0.3 ? true : velocity < -0.3 ? false : current > mid;
          if (shouldCollapse) {
            snapTo(SHEET_HIDDEN_OFFSET, () => setSheetVisible(false));
          } else {
            snapTo(0);
          }
        },
      }),
    []
  );

  const isPlanPage = route.params?.immediateTrip === true && !destination;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Página completa "Planeje sua corrida": sem mapa, sem bottom sheet — só header, pill, card e lista de endereços */}
      {isPlanPage && (
        <View style={[styles.planPage, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.planPageHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Planeje sua corrida</Text>
          </View>
          <TouchableOpacity
            style={styles.agoraPillWrap}
            onPress={() => setPlanWhenModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={styles.agoraPill}>
              <MaterialIcons name="schedule" size={20} color={COLORS.black} />
              <Text style={styles.agoraPillText}>Agora</Text>
              <MaterialIcons name="keyboard-arrow-down" size={20} color={COLORS.black} />
            </View>
          </TouchableOpacity>
          <Modal visible={planWhenModalVisible} transparent animationType="fade">
            <Pressable style={styles.planWhenOverlay} onPress={() => setPlanWhenModalVisible(false)}>
              <Pressable style={styles.planWhenSheet} onPress={(e) => e.stopPropagation()}>
                <Text style={styles.planWhenTitle}>Quando?</Text>
                <TouchableOpacity style={styles.planWhenOption} onPress={() => setPlanWhenModalVisible(false)} activeOpacity={0.7}>
                  <MaterialIcons name="schedule" size={24} color={COLORS.black} />
                  <Text style={styles.planWhenOptionText}>Agora</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.planWhenOption}
                  onPress={() => {
                    setPlanWhenModalVisible(false);
                    navigation.navigate('PlanRide', {
                      origin: { address: origin.address, latitude: origin.latitude, longitude: origin.longitude },
                      destination: undefined,
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="event" size={24} color={COLORS.black} />
                  <Text style={styles.planWhenOptionText}>Escolher data</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>
          <TouchableOpacity style={styles.routeCard} activeOpacity={0.8} onPress={openEditModal}>
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
              <Text style={[styles.routeAddress, styles.routeAddressPlaceholder]} numberOfLines={1}>Para onde?</Text>
            </View>
            <MaterialIcons name="edit" size={20} color={COLORS.neutral700} style={styles.editIcon} />
          </TouchableOpacity>
          <ScrollView
            style={styles.planPageScroll}
            contentContainerStyle={styles.planPageScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {sortedRecentDestinationsForPlan.map((item, index) => {
              const distKm = distanceKm(origin.latitude, origin.longitude, item.latitude, item.longitude);
              const distanceLabel = distKm != null ? formatDistanceKm(distKm) : null;
              const destPlace = {
                address: item.address,
                latitude: item.latitude ?? DEFAULT_DESTINATION_COORDS.latitude,
                longitude: item.longitude ?? DEFAULT_DESTINATION_COORDS.longitude,
              };
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.recentListPageRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    navigation.navigate('PlanRide', {
                      origin: { address: origin.address, latitude: origin.latitude, longitude: origin.longitude },
                      destination: { address: destPlace.address, latitude: destPlace.latitude, longitude: destPlace.longitude },
                    });
                  }}
                >
                  <View style={styles.recentIconAndDistance}>
                    <View style={styles.recentIconWrap}>
                      <MaterialIcons name="access-time" size={24} color={COLORS.black} />
                    </View>
                    {distanceLabel != null && (
                      <Text style={styles.recentDistance} numberOfLines={1}>{distanceLabel}</Text>
                    )}
                  </View>
                  <View style={styles.recentTextWrap}>
                    <Text style={styles.recentAddress} numberOfLines={1}>{item.address}</Text>
                    <Text style={styles.recentCity}>{item.city}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Mapa: só na tela com sheet (quando não estamos na página completa Planeje sua corrida) */}
      {!isPlanPage && (
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {destination && (
          <Polyline
            coordinates={
              routeCoords && routeCoords.length > 0
                ? routeCoords
                : [
                    { latitude: origin.latitude, longitude: origin.longitude },
                    { latitude: destination.latitude, longitude: destination.longitude },
                  ]
            }
            strokeColor={COLORS.black}
            strokeWidth={4}
          />
        )}
        {userLocationCoords && (
          <Marker
            coordinate={userLocationCoords}
            anchor={{ x: 0.5, y: 1 }}
            title="Sua localização"
            tracksViewChanges={markersTrackView}
          >
            <MyLocationMarkerIcon />
          </Marker>
        )}
        {(!userLocationCoords || Math.abs(origin.latitude - userLocationCoords.latitude) > 1e-5 || Math.abs(origin.longitude - userLocationCoords.longitude) > 1e-5) && (
          <Marker
            coordinate={{ latitude: origin.latitude, longitude: origin.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            title="Partida"
            description={origin.address}
            pinColor="#0d0d0d"
            tracksViewChanges={false}
          />
        )}
        {destination && (
          <Marker
            coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            title="Destino"
            description={destination.address}
            pinColor="#dc2626"
            tracksViewChanges={false}
          />
        )}
        {/* Marcadores de viagens disponíveis no local de partida (cada viagem tem um motorista responsável) */}
        {scheduledTrips.map((trip) => (
          <Marker
            key={trip.id}
            coordinate={{ latitude: trip.origin_lat, longitude: trip.origin_lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            title={trip.title}
            description={`Viagem · ${trip.driverName} · Saída ${trip.departure}`}
            tracksViewChanges={markersTrackView}
          >
            <DriverMarkerIcon />
          </Marker>
        ))}
      </MapView>
      )}

      {/* Em modo Planeje sua corrida sem destino: área em branco no lugar do mapa */}
      {route.params?.immediateTrip === true && !destination && (
        <View style={styles.mapPlaceholder} />
      )}

      {/* Botão: centralizar mapa na minha localização (só quando o mapa está visível) */}
      {!(route.params?.immediateTrip === true && !destination) && (
      <TouchableOpacity
        style={[styles.centerOnMeButton, { top: insets.top + 12 }]}
        onPress={centerMapOnMyLocation}
        disabled={mapCentering}
        activeOpacity={0.8}
      >
        {mapCentering ? (
          <ActivityIndicator size="small" color={COLORS.black} />
        ) : (
          <MaterialIcons name="my-location" size={24} color={COLORS.black} />
        )}
      </TouchableOpacity>
      )}

      {/* Botão para abrir o sheet quando estiver fechado (fechar = puxar para baixo) — só quando não é a página completa */}
      {!isPlanPage && !sheetVisible && (
        <TouchableOpacity
          style={[styles.expandButton, { bottom: Math.max(insets.bottom, 16) + 16 }]}
          onPress={showSheet}
          activeOpacity={0.8}
        >
          <MaterialIcons name="keyboard-arrow-up" size={28} color={COLORS.black} />
          <Text style={styles.expandButtonText}>Ver opções da viagem</Text>
        </TouchableOpacity>
      )}

      {/* Bottom sheet: só na tela com mapa (não na página completa Planeje sua corrida) */}
      {!isPlanPage && (
      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetHeightState,
            paddingBottom: Math.max(insets.bottom, 16),
            transform: [{ translateY: sheetTranslateY }],
          },
        ]}
      >
        <View style={styles.sheetHandleTouch} {...panResponder.panHandlers}>
          <View style={styles.sheetHandle} />
        </View>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {route.params?.immediateTrip ? 'Planeje sua corrida' : 'Procurando viagem'}
          </Text>
        </View>
        {route.params?.immediateTrip === true && (
          <View style={styles.agoraPillWrap}>
            <View style={styles.agoraPill}>
              <MaterialIcons name="schedule" size={20} color={COLORS.black} />
              <Text style={styles.agoraPillText}>Agora</Text>
              <MaterialIcons name="keyboard-arrow-down" size={20} color={COLORS.black} />
            </View>
          </View>
        )}

        <Animated.ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleSheetScroll}
          scrollEventThrottle={16}
        >
          {/* Partida e destino — layout Figma: fundo escuro, ícone origem (círculo+ponto), linha, ícone destino (quadrado), endereços, lápis */}
          <TouchableOpacity style={styles.routeCard} activeOpacity={0.8} onPress={openEditModal}>
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
              <Text style={[styles.routeAddress, !destination && styles.routeAddressPlaceholder]} numberOfLines={1}>
                {destination ? destination.address : 'Para onde?'}
              </Text>
            </View>
            <MaterialIcons name="edit" size={20} color={COLORS.neutral700} style={styles.editIcon} />
          </TouchableOpacity>

          {recentDestinations.length > 0 && (
            <View style={styles.recentCard}>
              {recentDestinations
                .slice(0, route.params?.immediateTrip === true ? RECENT_LIST_SIZE_PLAN : RECENT_LIST_SIZE_DEFAULT)
                .map((item, index) => {
                const distKm = distanceKm(origin.latitude, origin.longitude, item.latitude, item.longitude);
                const distanceLabel = distKm != null ? formatDistanceKm(distKm) : null;
                return (
                  <TouchableOpacity
                    key={index}
                    style={styles.recentRow}
                    activeOpacity={0.7}
                    onPress={() => setDestination({
                      address: item.address,
                      latitude: item.latitude ?? DEFAULT_DESTINATION_COORDS.latitude,
                      longitude: item.longitude ?? DEFAULT_DESTINATION_COORDS.longitude,
                    })}
                  >
                    <View style={styles.recentIconAndDistance}>
                      <View style={styles.recentIconWrap}>
                        <MaterialIcons name="access-time" size={24} color={COLORS.black} />
                      </View>
                      {distanceLabel != null && (
                        <Text style={styles.recentDistance} numberOfLines={1}>{distanceLabel}</Text>
                      )}
                    </View>
                    <View style={styles.recentTextWrap}>
                      <Text style={styles.recentAddress} numberOfLines={1}>{item.address}</Text>
                      <Text style={styles.recentCity}>{item.city}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Lista de viagens e botões: em "Planeje sua corrida" só aparecem depois de escolher um destino */}
          {(!(route.params?.immediateTrip === true) || destination) && (
          <>
          {tripsLoading ? (
            <View style={styles.tripsLoadingRow}>
              <ActivityIndicator size="small" color={COLORS.black} />
              <Text style={styles.tripsLoadingText}>Carregando viagens...</Text>
            </View>
          ) : tripsError ? (
            <View style={styles.tripsErrorRow}>
              <Text style={styles.tripsErrorText}>{tripsError}</Text>
            </View>
          ) : (
            scheduledTrips.map((trip) => {
              const isSelected = selectedTripId === trip.id;
              return (
                <TouchableOpacity
                  key={trip.id}
                  style={[styles.tripCard, isSelected && styles.tripCardSelected]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedTripId(isSelected ? null : trip.id)}
                >
                  <View style={styles.tripCardTopRow}>
                    {trip.driverAvatarUrl ? (
                      <Image
                        source={{ uri: trip.driverAvatarUrl.startsWith('http') ? trip.driverAvatarUrl : `${supabaseUrl}/storage/v1/object/public/avatars/${trip.driverAvatarUrl}` }}
                        style={styles.tripCardAvatar}
                      />
                    ) : (
                      <View style={[styles.tripCardAvatar, styles.tripCardAvatarFallback]}>
                        <Text style={styles.tripCardAvatarInitials}>{getInitials(trip.driverName)}</Text>
                      </View>
                    )}
                    <View style={styles.tripCardDriverWrap}>
                      <Text style={styles.tripCardDriverName}>{trip.driverName}</Text>
                      <Text style={styles.tripCardRating}>★ {trip.rating}</Text>
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
              );
            })
          )}

          <TouchableOpacity
            style={[styles.primaryButton, (tripsLoading || !destination || !selectedTripId) && styles.primaryButtonDisabled]}
            onPress={() => {
              if (!destination || !selectedTripId) return;
              const trip = scheduledTrips.find((t) => t.id === selectedTripId);
              if (!trip) return;
              navigation.navigate('ConfirmDetails', {
                driver: { id: trip.id, name: trip.driverName, rating: trip.rating, badge: trip.badge, departure: trip.departure, arrival: trip.arrival, seats: trip.seats, bags: trip.bags, amount_cents: trip.amount_cents ?? undefined },
                origin: { address: origin.address, latitude: origin.latitude, longitude: origin.longitude },
                destination: destination ? { address: destination.address, latitude: destination.latitude, longitude: destination.longitude } : undefined,
                scheduled_trip_id: trip.id,
                immediateTrip: route.params?.immediateTrip,
              });
            }}
            disabled={tripsLoading || !destination || !selectedTripId}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Avançar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              navigation.navigate('PlanRide', {
                origin: { address: origin.address, latitude: origin.latitude, longitude: origin.longitude },
                destination: destination ? { address: destination.address, latitude: destination.latitude, longitude: destination.longitude } : undefined,
              });
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Agendar para mais tarde</Text>
          </TouchableOpacity>
          </>
          )}
        </Animated.ScrollView>
      </Animated.View>
      )}

      {/* Modal: editar ponto de partida e destino — mesma animação do sheet da Home */}
      <Modal visible={editModalVisible} transparent animationType="none" onRequestClose={closeEditModal}>
        <KeyboardAvoidingView
          style={styles.editModalOverlayContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <Animated.View style={[styles.editModalOverlay, { opacity: editOverlayOpacity }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEditModal} />
          <Animated.View
            style={[styles.modalContent, { transform: [{ translateY: editSheetTranslateY }] }]}
          >
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
  },
  planPage: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
  },
  planPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
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
  centerOnMeButton: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetHandleTouch: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.neutral400,
  },
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
  agoraPillWrap: { paddingHorizontal: 24, paddingBottom: 12 },
  agoraPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.neutral300,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    gap: 8,
  },
  agoraPillText: { fontSize: 15, fontWeight: '600', color: COLORS.black },
  planWhenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  planWhenSheet: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 24,
  },
  planWhenTitle: { fontSize: 18, fontWeight: '700', color: COLORS.black, marginBottom: 16 },
  planWhenOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral300,
  },
  planWhenOptionText: { fontSize: 16, fontWeight: '500', color: COLORS.black },
  expandButton: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  expandButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  sheetScroll: { flex: 1 },
  sheetScrollContent: { paddingHorizontal: 24, paddingBottom: 24 },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.neutral400,
  },
  routeIconsColumn: {
    alignItems: 'center',
    marginRight: 12,
  },
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
  recentCard: {
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    borderRadius: 12,
    padding: 16,
    gap: 24,
    marginBottom: 16,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  recentIconAndDistance: {
    alignItems: 'center',
    minWidth: 48,
  },
  recentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentDistance: {
    fontSize: 12,
    color: COLORS.neutral700,
    marginTop: 4,
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
    backgroundColor: '#EEEEEE',
  },
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
  tripsLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16 },
  tripsLoadingText: { fontSize: 14, color: COLORS.neutral700 },
  tripsErrorRow: { paddingVertical: 16 },
  tripsErrorText: { fontSize: 14, color: '#dc2626' },
  primaryButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  primaryButtonDisabled: { opacity: 0.5 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  editModalOverlayContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  editModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
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
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.black,
    marginBottom: 16,
  },
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
});
