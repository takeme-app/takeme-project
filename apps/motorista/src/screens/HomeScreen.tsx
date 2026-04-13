import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
  Platform,
  Modal,
} from 'react-native';
import { Text } from '../components/Text';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { SCREEN_TOP_EXTRA_PADDING } from '../theme/screenLayout';
import {
  GoogleMapsMap,
  MapMarker,
  MapPolyline,
  MapZoomControls,
  regionFromLatLngPoints,
  isValidGlobeCoordinate,
  latLngFromDbColumns,
  MY_LOCATION_NAV_DELTA,
} from '../components/googleMaps';
import type { LatLng, GoogleMapsMapRef } from '../components/googleMaps';

let LocationMod: typeof import('expo-location') | null = null;
try {
  LocationMod = require('expo-location');
} catch {
  /* native rebuild */
}

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

type ActiveTrip = {
  id: string;
  origin_address: string;
  destination_address: string;
  departure_at: string;
  passengerCount: number;
  /** Malas informadas na reserva (`bookings.bags_count`), não é envio de encomenda. */
  bagsCount: number;
  /** Envios (`shipments`) vinculados a esta viagem agendada. */
  shipmentCount: number;
  trunkPct: number;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  bookingPickups: Array<{ lat: number; lng: number }>;
};

/** Região inicial do mapa a partir de origem/destino (fallback PB). */
function mapRegionForTrip(t: ActiveTrip): MapRegion {
  const oLat = t.origin_lat;
  const oLng = t.origin_lng;
  const dLat = t.destination_lat;
  const dLng = t.destination_lng;
  const oOk = oLat != null && oLng != null && Number.isFinite(oLat) && Number.isFinite(oLng);
  const dOk = dLat != null && dLng != null && Number.isFinite(dLat) && Number.isFinite(dLng);
  if (oOk && dOk) {
    const minLat = Math.min(oLat!, dLat!);
    const maxLat = Math.max(oLat!, dLat!);
    const minLng = Math.min(oLng!, dLng!);
    const maxLng = Math.max(oLng!, dLng!);
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const pad = 1.4;
    const latSpan = Math.max(0.008, (maxLat - minLat) * pad);
    const lngSpan = Math.max(0.008, (maxLng - minLng) * pad);
    return {
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: Math.max(latSpan, 0.04),
      longitudeDelta: Math.max(lngSpan, 0.04),
    };
  }
  if (oOk) {
    return { latitude: oLat!, longitude: oLng!, latitudeDelta: 0.06, longitudeDelta: 0.06 };
  }
  if (dOk) {
    return { latitude: dLat!, longitude: dLng!, latitudeDelta: 0.06, longitudeDelta: 0.06 };
  }
  return { latitude: -7.23, longitude: -35.88, latitudeDelta: 0.12, longitudeDelta: 0.12 };
}

function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
}

function shortAddr(addr: string): string {
  const parts = addr.split(',');
  return parts[0]?.trim() ?? addr;
}

export function HomeScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [cnhOk, setCnhOk] = useState(false);
  const [cnhBackOk, setCnhBackOk] = useState(false);
  /** Veículo com dados obrigatórios preenchidos mas sem CRLV/documento anexado. */
  const [missingVehicleDocument, setMissingVehicleDocument] = useState(false);
  const [available, setAvailable] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [mapUserLL, setMapUserLL] = useState<LatLng | null>(null);
  const homeMapRef = useRef<GoogleMapsMapRef>(null);
  const [promoModal, setPromoModal] = useState<{ id: string; title: string; gainPct: number; endAt: string } | null>(null);

  useEffect(() => {
    if (!LocationMod) return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await LocationMod.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const pos = await LocationMod.getCurrentPositionAsync({
          accuracy: LocationMod.Accuracy?.Balanced ?? LocationMod.Accuracy.Balanced,
        });
        if (!cancelled && pos?.coords) {
          setMapUserLL({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        }
      } catch {
        /* GPS off / timeout */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const homeTripMapRegion = useMemo(() => {
    // Prioridade: GPS do motorista → origem da viagem → destino.
    // Usa zoom de rua (0.04°) para não ficar parecendo oceano em cidades costeiras.
    if (mapUserLL && isValidGlobeCoordinate(mapUserLL.latitude, mapUserLL.longitude)) {
      return {
        latitude: mapUserLL.latitude,
        longitude: mapUserLL.longitude,
        latitudeDelta: MY_LOCATION_NAV_DELTA,
        longitudeDelta: MY_LOCATION_NAV_DELTA,
      };
    }
    if (activeTrip) {
      const originLL = latLngFromDbColumns(activeTrip.origin_lat, activeTrip.origin_lng);
      if (originLL) return { latitude: originLL.latitude, longitude: originLL.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 };
      const destLL = latLngFromDbColumns(activeTrip.destination_lat, activeTrip.destination_lng);
      if (destLL) return { latitude: destLL.latitude, longitude: destLL.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 };
    }
    return regionFromLatLngPoints([]);
  }, [
    mapUserLL,
    activeTrip?.origin_lat,
    activeTrip?.origin_lng,
    activeTrip?.destination_lat,
    activeTrip?.destination_lng,
  ]);

  /** Sem GPS e sem nenhuma coordenada válida da viagem → não montar MapView (evita 0,0 / oceano). */
  const homeMapReady = useMemo(() => {
    if (!activeTrip) return true;
    if (mapUserLL && isValidGlobeCoordinate(mapUserLL.latitude, mapUserLL.longitude)) return true;
    const oOk = latLngFromDbColumns(activeTrip.origin_lat, activeTrip.origin_lng) !== null;
    const dOk = latLngFromDbColumns(activeTrip.destination_lat, activeTrip.destination_lng) !== null;
    return oOk || dOk;
  }, [activeTrip, mapUserLL]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) { setUserId(null); setLoading(false); return; }
    setUserId(user.id);

    // Worker profile
    const { data: wr } = await supabase
      .from('worker_profiles')
      .select('cnh_document_url, cnh_document_back_url, is_available_for_requests')
      .eq('id', user.id)
      .maybeSingle();
    const w = wr as {
      cnh_document_url?: string | null;
      cnh_document_back_url?: string | null;
      is_available_for_requests?: boolean | null;
    } | null;
    setCnhOk(Boolean(w?.cnh_document_url?.trim()));
    setCnhBackOk(Boolean(w?.cnh_document_back_url?.trim()));
    setAvailable(w?.is_available_for_requests ?? false);

    // Documento do veículo (CRLV): só sinaliza se já existe veículo “completo” nos campos básicos mas sem arquivo
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('model, plate, year, passenger_capacity, vehicle_document_url')
      .eq('worker_id', user.id)
      .eq('is_active', true);
    const vRows = (vehicles ?? []) as {
      model?: string | null;
      plate?: string | null;
      year?: number | null;
      passenger_capacity?: number | null;
      vehicle_document_url?: string | null;
    }[];
    let missingVDoc = false;
    for (const v of vRows) {
      const structOk =
        Boolean(v.model?.trim()) &&
        Boolean(v.plate?.trim()) &&
        Boolean(v.year) &&
        Boolean(v.passenger_capacity);
      if (structOk && !v.vehicle_document_url?.trim()) {
        missingVDoc = true;
        break;
      }
    }
    setMissingVehicleDocument(missingVDoc);

    // Active trip
    const { data: tripData } = await supabase
      .from('scheduled_trips')
      .select(
        'id, origin_address, destination_address, departure_at, trunk_occupancy_pct, origin_lat, origin_lng, destination_lat, destination_lng, route_id, is_active, driver_journey_started_at',
      )
      .eq('driver_id', user.id)
      .eq('status', 'active')
      .not('driver_journey_started_at', 'is', null)
      .order('departure_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (tripData) {
      const t = tripData as {
        id: string;
        origin_address: string;
        destination_address: string;
        departure_at: string;
        trunk_occupancy_pct: number | null;
        origin_lat?: number | null;
        origin_lng?: number | null;
        destination_lat?: number | null;
        destination_lng?: number | null;
        route_id?: string | null;
        is_active?: boolean | null;
      };
      if (t.route_id != null && t.is_active === false) {
        setActiveTrip(null);
      } else {
      const { data: bkgs } = await supabase
        .from('bookings')
        .select('passenger_count, bags_count, origin_lat, origin_lng')
        .eq('scheduled_trip_id', t.id)
        .eq('status', 'confirmed');
      const bkgRows = (bkgs ?? []) as { passenger_count?: number; bags_count?: number; origin_lat?: number | null; origin_lng?: number | null }[];
      const passengerCount = bkgRows.reduce((s, b) => s + (b.passenger_count ?? 0), 0);
      const bagsCount = bkgRows.reduce((s, b) => s + (b.bags_count ?? 0), 0);

      const { count: shipCount } = await supabase
        .from('shipments')
        .select('id', { count: 'exact', head: true })
        .eq('scheduled_trip_id' as never, t.id as never)
        .eq('driver_id', user.id)
        .in('status', ['confirmed', 'in_progress'] as never);

      const bookingPickups = bkgRows
        .filter((b) => b.origin_lat != null && b.origin_lng != null)
        .map((b) => ({ lat: b.origin_lat!, lng: b.origin_lng! }));
        setActiveTrip({
          id: t.id,
          origin_address: t.origin_address,
          destination_address: t.destination_address,
          departure_at: t.departure_at,
          passengerCount,
          bagsCount,
          shipmentCount: shipCount ?? 0,
          trunkPct: t.trunk_occupancy_pct ?? 0,
          origin_lat: t.origin_lat ?? null,
          origin_lng: t.origin_lng ?? null,
          destination_lat: t.destination_lat ?? null,
          destination_lng: t.destination_lng ?? null,
          bookingPickups,
        });
      }
    } else {
      setActiveTrip(null);
    }

    // Solicitações aguardando aceite: reservas (pending/paid) + encomendas sem base na rota (sem driver_id)
    const { count: bCount } = await supabase
      .from('bookings')
      .select('id, scheduled_trips!inner(driver_id)', { count: 'exact', head: true })
      .in('status', ['pending', 'paid'])
      .eq('scheduled_trips.driver_id', user.id);

    const { data: tripIdsRows } = await supabase
      .from('scheduled_trips')
      .select('id')
      .eq('driver_id', user.id);
    const myTripIds = (tripIdsRows ?? []).map((r) => (r as { id: string }).id);
    let sPending = 0;
    if (myTripIds.length > 0) {
      const { count: sCount } = await supabase
        .from('shipments')
        .select('id', { count: 'exact', head: true })
        .in('scheduled_trip_id', myTripIds)
        .is('base_id', null)
        .is('driver_id', null)
        .in('status', ['pending_review', 'confirmed']);
      sPending = sCount ?? 0;
    }

    setPendingCount((bCount ?? 0) + sPending);

    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Check for active promotions targeting drivers
  useFocusEffect(useCallback(() => {
    if (!userId) return;
    void (async () => {
      const { data: promos } = await (supabase as any)
        .from('promotions')
        .select('id, title, gain_pct_to_worker, end_at')
        .eq('is_active', true)
        .lte('start_at', new Date().toISOString())
        .gte('end_at', new Date().toISOString())
        .contains('target_audiences', ['drivers'])
        .order('gain_pct_to_worker', { ascending: false })
        .limit(1);
      if (!promos || promos.length === 0) return;
      const promo = promos[0];
      // Check if already adhered
      const { data: existing } = await (supabase as any)
        .from('promotion_adhesions')
        .select('id')
        .eq('promotion_id', promo.id)
        .eq('user_id', userId)
        .maybeSingle();
      if (existing) return; // Already adhered
      setPromoModal({ id: promo.id, title: promo.title, gainPct: promo.gain_pct_to_worker || 0, endAt: promo.end_at });
    })();
  }, [userId]));

  const acceptPromotion = async () => {
    if (!promoModal || !userId) return;
    await (supabase as any).from('promotion_adhesions').insert({
      promotion_id: promoModal.id,
      user_id: userId,
      user_type: 'motorista',
    });
    setPromoModal(null);
  };

  const onToggleAvailable = async (value: boolean) => {
    if (!userId || toggleLoading) return;
    setToggleLoading(true);
    setAvailable(value);
    const { error } = await supabase
      .from('worker_profiles')
      .update({ is_available_for_requests: value, updated_at: new Date().toISOString() } as never)
      .eq('id', userId);
    if (error) setAvailable(!value);
    setToggleLoading(false);
  };

  const updateTrunk = async (delta: number) => {
    if (!activeTrip || !userId) return;
    const newPct = Math.max(0, Math.min(100, activeTrip.trunkPct + delta));
    setActiveTrip((prev) => prev ? { ...prev, trunkPct: newPct } : prev);
    await supabase
      .from('scheduled_trips')
      .update({ trunk_occupancy_pct: newPct } as never)
      .eq('id', activeTrip.id);
  };

  const goRoutes = () => navigation.navigate('Profile', { screen: 'WorkerRoutes', params: { fromHome: true } });
  const goSchedule = () => navigation.navigate('Profile', { screen: 'TripSchedule', params: { fromHome: true } });
  const goPending = () => navigation.navigate('PendingRequests');

  const goDocumentsBanner = () => {
    if (!cnhOk || !cnhBackOk) {
      navigation.navigate('Profile', { screen: 'PersonalInfo' });
      return;
    }
    if (missingVehicleDocument) {
      navigation.navigate('Profile', { screen: 'WorkerVehicles' });
    }
  };

  /** Só documentação pendente (CNH frente/verso ou CRLV do veículo); não PIX nem rotas. */
  const showDocumentsBanner = !cnhOk || !cnhBackOk || missingVehicleDocument;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.center}><ActivityIndicator size="large" color="#111827" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {showDocumentsBanner && (
          <TouchableOpacity style={styles.banner} onPress={goDocumentsBanner} activeOpacity={0.85}>
            <Text style={styles.bannerText}>
              {!cnhOk
                ? 'Adicione a foto da CNH (frente) para concluir seus documentos.'
                : !cnhBackOk
                  ? 'Adicione a foto da CNH (verso) para concluir seus documentos.'
                  : 'Anexe o documento do veículo (CRLV) para concluir o cadastro.'}
            </Text>
            <View style={styles.bannerArrow}>
              <MaterialIcons name="arrow-forward" size={20} color="#5C3D2E" />
            </View>
          </TouchableOpacity>
        )}

        {/* Card da viagem ativa */}
        {activeTrip && (
          <View style={styles.tripCard}>
            <View style={styles.ongoingStrip} accessibilityLabel="Corrida em andamento">
              <MaterialIcons name="directions-car" size={20} color="#166534" />
              <Text style={styles.ongoingStripText}>Corrida em andamento</Text>
            </View>
            {/* Linha de rota */}
            <View style={styles.routeLine}>
              <View style={styles.routeStop}>
                <View style={styles.dotOrigin} />
                <View style={styles.routeConnector} />
                <View style={styles.dotDest} />
              </View>
              <View style={styles.routeAddresses}>
                <View style={styles.routeAddressGroup}>
                  <Text style={styles.routeAddressLabel}>Origem</Text>
                  <Text style={styles.routeAddressValue}>{shortAddr(activeTrip.origin_address)}</Text>
                </View>
                <View style={styles.routeAddressGroup}>
                  <Text style={styles.routeAddressLabel}>Destino</Text>
                  <Text style={styles.routeAddressValue}>{shortAddr(activeTrip.destination_address)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.tripMeta}>
              <View style={styles.metaItem}>
                <MaterialIcons name="access-time" size={18} color="#6B7280" />
                <View>
                  <Text style={styles.metaLabel}>Horário</Text>
                  <Text style={styles.metaValue}>{formatTime(activeTrip.departure_at)}</Text>
                </View>
              </View>
              <View style={styles.metaItem}>
                <MaterialIcons name="people" size={18} color="#6B7280" />
                <View>
                  <Text style={styles.metaLabel}>Passageiros</Text>
                  <Text style={styles.metaValue}>{activeTrip.passengerCount}</Text>
                </View>
              </View>
              {activeTrip.bagsCount > 0 ? (
                <View style={styles.metaItem}>
                  <MaterialIcons name="card-travel" size={18} color="#6B7280" />
                  <View>
                    <Text style={styles.metaLabel}>Malas</Text>
                    <Text style={styles.metaValue}>{activeTrip.bagsCount}</Text>
                  </View>
                </View>
              ) : null}
              {activeTrip.shipmentCount > 0 ? (
                <View style={styles.metaItem}>
                  <MaterialIcons name="inventory-2" size={18} color="#6B7280" />
                  <View>
                    <Text style={styles.metaLabel}>Encomendas</Text>
                    <Text style={styles.metaValue}>{activeTrip.shipmentCount}</Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* Bagageiro */}
            <View style={styles.trunkRow}>
              <View style={styles.trunkBarWrap}>
                <View style={styles.trunkBarBg}>
                  <View
                    style={[
                      styles.trunkBarFill,
                      {
                        width: `${activeTrip.trunkPct}%` as any,
                        backgroundColor:
                          activeTrip.trunkPct >= 80 ? '#EF4444'
                          : activeTrip.trunkPct >= 50 ? '#C9A227'
                          : '#22C55E',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.trunkLabel}>Bagageiro: {activeTrip.trunkPct}%</Text>
              </View>
              <View style={styles.trunkStepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => updateTrunk(-10)} activeOpacity={0.7}>
                  <MaterialIcons name="remove" size={16} color="#374151" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepBtn} onPress={() => updateTrunk(10)} activeOpacity={0.7}>
                  <MaterialIcons name="add" size={16} color="#374151" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Mapa da viagem ativa — largura total (evita w=0 com alignItems:center no ScrollView) */}
            <View style={styles.mapWrap}>
              <GoogleMapsMap
                ref={homeMapRef}
                key={`home-map-${activeTrip.id}`}
                style={styles.mapInner}
                initialRegion={mapRegionForTrip(activeTrip)}
                scrollEnabled={false}
              >
                {activeTrip.origin_lat != null &&
                  activeTrip.origin_lng != null &&
                  activeTrip.destination_lat != null &&
                  activeTrip.destination_lng != null && (
                    <MapPolyline
                      id="home-preview"
                      coordinates={[
                        { latitude: activeTrip.origin_lat, longitude: activeTrip.origin_lng },
                        { latitude: activeTrip.destination_lat, longitude: activeTrip.destination_lng },
                      ]}
                      strokeColor="#C9A227"
                      strokeWidth={4}
                    />
                  )}
                {activeTrip.origin_lat != null && activeTrip.origin_lng != null && (
                  <MapMarker
                    id="origin"
                    coordinate={{ latitude: activeTrip.origin_lat, longitude: activeTrip.origin_lng }}
                    pinColor="#111827"
                  />
                )}
                {activeTrip.destination_lat != null && activeTrip.destination_lng != null && (
                  <MapMarker
                    id="dest"
                    coordinate={{ latitude: activeTrip.destination_lat, longitude: activeTrip.destination_lng }}
                    pinColor="#C9A227"
                  />
                )}
                {activeTrip.bookingPickups.map((p, i) => (
                  <MapMarker
                    key={`pickup-${i}`}
                    id={`pickup-${i}`}
                    coordinate={{ latitude: p.lat, longitude: p.lng }}
                    pinColor="#22C55E"
                  />
                ))}
              </GoogleMapsMap>
              <MapZoomControls mapRef={homeMapRef} style={styles.homeMapZoom} />
            </View>

            <TouchableOpacity style={styles.mapBtn} activeOpacity={0.85} onPress={() => activeTrip && navigation.navigate('ActiveTrip', { tripId: activeTrip.id })}>
              <Text style={styles.mapBtnText}>Ver rota no mapa</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Acesso rápido */}
        <Text style={styles.sectionTitle}>Acesso rápido</Text>
        <View style={styles.quickGrid}>
          <TouchableOpacity style={styles.quickCard} onPress={goPending} activeOpacity={0.85}>
            <View style={styles.quickIconWrap}>
              <MaterialIcons name="description" size={28} color="#111827" />
              {pendingCount > 0 && <View style={styles.dot} />}
            </View>
            <Text style={styles.quickLabel}>Viagens{'\n'}pendentes</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickCard} onPress={goSchedule} activeOpacity={0.85}>
            <MaterialIcons name="calendar-today" size={28} color="#111827" />
            <Text style={styles.quickLabel}>Visualizar{'\n'}cronograma</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.quickWide} onPress={goRoutes} activeOpacity={0.85}>
          <MaterialIcons name="place" size={26} color="#111827" />
          <Text style={styles.quickWideLabel}>Rotas e valores</Text>
        </TouchableOpacity>

        {/* Toggle Em viagem */}
        <View style={styles.availRow}>
          <Text style={styles.availLabel}>Em viagem</Text>
          <Switch
            value={activeTrip ? true : available}
            onValueChange={onToggleAvailable}
            disabled={toggleLoading || Boolean(activeTrip)}
            trackColor={{ false: '#E5E7EB', true: '#111827' }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={styles.divider} />
      </ScrollView>

      {/* Promotion opt-in modal */}
      <Modal visible={!!promoModal} transparent animationType="fade" onRequestClose={() => setPromoModal(null)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, gap: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#0d0d0d', textAlign: 'center' }}>
              {'\uD83C\uDF89'} Promoção Especial!
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#0d0d0d', textAlign: 'center' }}>
              {promoModal?.title}
            </Text>
            <View style={{ backgroundColor: '#f0faf4', borderRadius: 12, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 32, fontWeight: '700', color: '#0d8344' }}>
                +{promoModal?.gainPct || 0}%
              </Text>
              <Text style={{ fontSize: 14, color: '#174f38', textAlign: 'center', marginTop: 4 }}>
                de ganho extra por viagem
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: '#767676', textAlign: 'center' }}>
              Válido até {promoModal?.endAt ? new Date(promoModal.endAt).toLocaleDateString('pt-BR') : '—'}
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#0d0d0d', borderRadius: 999, paddingVertical: 14, alignItems: 'center' }}
              onPress={acceptPromotion}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Aceitar promoção</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPromoModal(null)} activeOpacity={0.7}>
              <Text style={{ fontSize: 14, color: '#767676', textAlign: 'center' }}>Depois</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12 + SCREEN_TOP_EXTRA_PADDING },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF6EA',
    borderWidth: 1,
    borderColor: '#D4A84B',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 20,
    gap: 14,
  },
  bannerText: { flex: 1, fontSize: 14, color: '#5C3D2E', lineHeight: 20, fontWeight: '600' },
  bannerArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3D565',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Trip card
  tripCard: {
    borderWidth: 1.5, borderColor: '#111827', borderRadius: 16,
    padding: 20, marginBottom: 24,
  },
  ongoingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  ongoingStripText: { fontSize: 15, fontWeight: '700', color: '#166534' },
  routeLine: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  routeStop: { alignItems: 'center', paddingTop: 4 },
  dotOrigin: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827',
  },
  routeConnector: { width: 2, flex: 1, backgroundColor: '#D1D5DB', marginVertical: 4 },
  dotDest: {
    width: 10, height: 10, borderRadius: 2, backgroundColor: '#111827',
  },
  routeAddresses: { flex: 1, justifyContent: 'space-between' },
  routeAddressGroup: { gap: 2, marginBottom: 8 },
  routeAddressLabel: { fontSize: 12, color: '#9CA3AF' },
  routeAddressValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  tripMeta: { gap: 14, marginBottom: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaLabel: { fontSize: 12, color: '#9CA3AF' },
  metaValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  mapWrap: {
    height: 180,
    width: '100%',
    borderRadius: 12,
    marginBottom: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E5E7EB',
  },
  mapInner: { width: '100%', height: '100%' },
  homeMapZoom: { right: 8, bottom: 8 },
  mapPlaceholder: {
    height: 160,
    width: '100%',
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    marginBottom: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  mapPreviewInner: { width: '100%', height: '100%', borderRadius: 12 },
  mapPreviewLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#E5E7EB',
  },
  mapPreviewLoadingText: { fontSize: 13, color: '#6B7280' },
  mapBtn: {
    borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 0,
  },
  mapBtnText: { fontSize: 15, fontWeight: '600', color: '#111827' },

  // Quick access
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 14 },
  quickGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  quickCard: {
    flex: 1, backgroundColor: '#F3F4F6', borderRadius: 14,
    paddingVertical: 20, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center', minHeight: 110,
  },
  quickIconWrap: { position: 'relative', marginBottom: 10 },
  dot: {
    position: 'absolute', top: -2, right: -4,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#F3F4F6',
  },
  quickLabel: { fontSize: 13, fontWeight: '600', color: '#111827', textAlign: 'center' },
  quickWide: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F3F4F6', borderRadius: 14,
    paddingVertical: 18, paddingHorizontal: 16, marginBottom: 28,
  },
  quickWideLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },

  availRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8,
  },
  availLabel: { fontSize: 16, fontWeight: '600', color: '#111827' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginTop: 12 },

  trunkRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, gap: 12,
  },
  trunkBarWrap: { flex: 1 },
  trunkBarBg: {
    height: 6, backgroundColor: '#E5E7EB', borderRadius: 3,
    marginBottom: 4, overflow: 'hidden',
  },
  trunkBarFill: { height: 6, borderRadius: 3 },
  trunkLabel: { fontSize: 12, color: '#6B7280' },
  trunkStepper: { flexDirection: 'row', gap: 6 },
  stepBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
});
