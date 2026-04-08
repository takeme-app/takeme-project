import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ColetasExcursoesStackParamList } from '../../navigation/ColetasExcursoesStack';
import { SCREEN_TOP_EXTRA_PADDING } from '../../theme/screenLayout';
import { googleForwardGeocode } from '@take-me/shared';
import { supabase } from '../../lib/supabase';
import { ensureExcursionClientConversation } from '../../lib/excursionClientConversation';
import { navigateExcursionTabToChatThread } from '../../navigation/excursionNavigateToChat';
import { passengerTotalLabel } from './excursionFormat';
import { getGoogleMapsApiKey, getMapboxAccessToken } from '../../lib/googleMapsConfig';
import {
  GoogleMapsMap,
  MapMarker,
  MapPolyline,
  MapZoomControls,
  latLngFromDbColumns,
  mergeLngLatPointsForCamera,
  toLngLatPair,
  useMapCameraApply,
  isValidGlobeCoordinate,
  MY_LOCATION_NAV_DELTA,
} from '../../components/googleMaps';
import type { LatLng, MapRegion, GoogleMapsMapRef } from '../../components/googleMaps';
import { getRouteWithDuration, formatEta } from '../../lib/route';

let Location: any = null;
try {
  Location = require('expo-location');
} catch {
  /* módulo nativo ausente até rebuild */
}

const { height: SCREEN_H } = Dimensions.get('window');
const MAP_HEIGHT = SCREEN_H * 0.38;

// Fallback quando não há GPS nem coords no pedido (São Paulo — nunca use 0,0)
const DEFAULT_COORD: [number, number] = [-46.6333, -23.5505];

/** Mapa sem centro válido cai no Atlântico (~0,0). Garante sempre [lng,lat] finito. */
function safeMapCenter(pair: [number, number] | null | undefined): [number, number] {
  if (!pair || pair.length < 2) return DEFAULT_COORD;
  const lng = pair[0];
  const lat = pair[1];
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return DEFAULT_COORD;
  if (Math.abs(lng) < 1e-6 && Math.abs(lat) < 1e-6) return DEFAULT_COORD;
  if (lat < -85 || lat > 85 || lng < -180 || lng > 180) return DEFAULT_COORD;
  return [lng, lat];
}

function toFiniteNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return null;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * [lng, lat] para câmera/marcadores. Rejeita null/NaN e (0,0) — emulador/GPS às vezes devolve 0,0 = Atlântico.
 */
function validCoordPair(lng: unknown, lat: unknown): [number, number] | null {
  const ln = toFiniteNumber(lng);
  const la = toFiniteNumber(lat);
  if (ln == null || la == null) return null;
  if (Math.abs(ln) < 1e-6 && Math.abs(la) < 1e-6) return null;
  if (la < -85 || la > 85 || ln < -180 || ln > 180) return null;
  return [ln, la];
}

/** Pontos [lng,lat] únicos: você, destino, origem — para enquadrar o mapa e ver a rota inteira. */
function collectMapPoints(
  user: [number, number] | null,
  dest: [number, number] | null,
  origin: [number, number] | null,
): [number, number][] {
  const out: [number, number][] = [];
  const seen = new Set<string>();
  for (const p of [user, dest, origin]) {
    if (!p) continue;
    const k = `${p[0].toFixed(5)}_${p[1].toFixed(5)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

function toLatLng(p: [number, number]): LatLng {
  return { longitude: p[0], latitude: p[1] };
}

type Props = NativeStackScreenProps<ColetasExcursoesStackParamList, 'DetalhesExcursao'>;

type ExcursionDetail = {
  id: string;
  origin: string;
  destination: string;
  departureTime: string | null;
  returnTime: string | null;
  transportType: string;
  responsible: string;
  direction: string;
  status: string;
  originLat: number | null;
  originLng: number | null;
  destLat: number | null;
  destLng: number | null;
  createdAt: string | null;
  confirmedAt: string | null;
  clientPhone: string | null;
  clientUserId: string;
  clientAvatarUrl: string | null;
  registeredPassengerCount: number;
};

const CARD_GOLD = '#C9A227';

type StatusConfig = { label: string; bg: string; text: string; border: string };

const STATUS_MAP: Record<string, StatusConfig> = {
  contacted:      { label: 'Em andamento',       bg: '#FEF3C7', text: '#92400E', border: '#C9A227' },
  in_progress:    { label: 'Em andamento',       bg: '#FEF3C7', text: '#92400E', border: '#C9A227' },
  scheduled:      { label: 'Em andamento',       bg: '#FEF3C7', text: '#92400E', border: '#C9A227' },
  active:         { label: 'Em andamento',       bg: '#FEF3C7', text: '#92400E', border: '#C9A227' },
  payment_done:   { label: 'Pagamento realizado', bg: '#DBEAFE', text: '#1E40AF', border: '#E5E7EB' },
  paid:           { label: 'Pagamento realizado', bg: '#DBEAFE', text: '#1E40AF', border: '#E5E7EB' },
  approved:       { label: 'Pagamento realizado', bg: '#DBEAFE', text: '#1E40AF', border: '#E5E7EB' },
  quoted:         { label: 'Orçamento enviado',  bg: '#E0E7FF', text: '#3730A3', border: '#E5E7EB' },
  in_analysis:    { label: 'Em análise',         bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
  pending:        { label: 'Pendente',           bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
  pending_rating: { label: 'Avaliação Pendente', bg: '#E8EEF9', text: '#1E3A5F', border: '#E5E7EB' },
  confirmed:      { label: 'Concluído',          bg: '#D1FAE5', text: '#065F46', border: '#E5E7EB' },
  completed:      { label: 'Concluído',          bg: '#D1FAE5', text: '#065F46', border: '#E5E7EB' },
  cancelled:      { label: 'Cancelado',          bg: '#FEE2E2', text: '#991B1B', border: '#E5E7EB' },
};

const DEFAULT_STATUS: StatusConfig = { label: 'Pendente', bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' };

function statusCfg(status: string): StatusConfig {
  return STATUS_MAP[status] ?? DEFAULT_STATUS;
}

function fleetTypeLabel(v: string | null | undefined): string {
  if (!v) return 'Van';
  const m: Record<string, string> = {
    carro: 'Carro',
    van: 'Van',
    micro_onibus: 'Micro-ônibus',
    onibus: 'Ônibus Executivo',
  };
  return m[v] ?? v;
}

function formatDateLabel(iso: string | null, direction: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const day = d.getDate().toString().padStart(2, '0');
    const mon = months[d.getMonth()] ?? '';
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${day} ${mon} • ${time} (${direction})`;
  } catch { return '—'; }
}

function formatTimelineSubtitle(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const day = d.getDate().toString().padStart(2, '0');
    const mon = months[d.getMonth()] ?? '';
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${day} ${mon}, ${time}`;
  } catch { return '—'; }
}

function timelineSubtitlesForDetail(d: ExcursionDetail): string[] {
  const dep = d.departureTime;
  return [
    formatTimelineSubtitle(d.createdAt),
    formatTimelineSubtitle(d.confirmedAt),
    formatTimelineSubtitle(dep),
    formatTimelineSubtitle(dep),
  ];
}

function timelineSteps(status: string): boolean[] {
  const afterPayment = [
    'approved', 'scheduled', 'in_progress', 'completed',
    'payment_done', 'paid', 'pending_rating', 'confirmed',
  ];
  const afterBoarding = ['scheduled', 'in_progress', 'completed', 'confirmed'];
  const afterDeparted = ['in_progress', 'completed'];
  return [
    true,
    afterPayment.includes(status),
    afterBoarding.includes(status),
    afterDeparted.includes(status),
  ];
}

const TIMELINE_LABELS = ['Pedido feito', 'Pagamento aprovado', 'Embarque confirmado', 'Ônibus partiu'];
const BOARDING_ACTION_STATUSES = ['approved', 'scheduled', 'in_progress', 'payment_done', 'paid', 'active'];

export function DetalhesExcursaoScreen({ navigation, route }: Props) {
  const { excursionId } = route.params;
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ExcursionDetail | null>(null);
  const [cardExpanded, setCardExpanded] = useState(true);
  const [userLngLat, setUserLngLat] = useState<[number, number] | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [routeEtaSec, setRouteEtaSec] = useState<number | null>(null);
  /** Fallback quando o pedido só tem texto de destino (sem destination_lat no banco). */
  const [geocodedDestCoord, setGeocodedDestCoord] = useState<[number, number] | null>(null);
  /** Fallback para origem só em texto (sem origin_lat no banco). */
  const [geocodedOriginCoord, setGeocodedOriginCoord] = useState<[number, number] | null>(null);
  const [openingChat, setOpeningChat] = useState(false);
  const excursionMapRef = useRef<GoogleMapsMapRef>(null);
  const [followMyLocation, setFollowMyLocation] = useState(false);
  const followFirstAnimDoneRef = useRef(false);
  const followRef = useRef(false);
  useEffect(() => {
    followRef.current = followMyLocation;
  }, [followMyLocation]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('excursion_requests')
      .select(
        'id, destination, excursion_date, scheduled_departure_at, fleet_type, status, user_id, created_at, confirmed_at',
      )
      .eq('id', excursionId)
      .maybeSingle();

    if (!data) { setLoading(false); return; }
    const r = data as any;

    let responsible: string | null = null;
    let clientPhone: string | null = null;
    let clientAvatarUrl: string | null = null;
    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name, phone, avatar_url')
      .eq('id', r.user_id)
      .maybeSingle();
    if (prof) {
      const pr = prof as { full_name?: string | null; phone?: string | null; avatar_url?: string | null };
      if (!responsible) responsible = pr.full_name ?? 'Cliente';
      clientPhone = pr.phone?.trim() ? pr.phone : null;
      clientAvatarUrl = pr.avatar_url?.trim() ? pr.avatar_url.trim() : null;
    }
    if (!responsible) responsible = 'Cliente';

    const { count: psgCount } = await supabase
      .from('excursion_passengers')
      .select('id', { count: 'exact', head: true })
      .eq('excursion_request_id', r.id);

    const depIso = r.scheduled_departure_at ?? r.excursion_date ?? null;
    const retIso = null;

    setDetail({
      id: r.id,
      origin: 'Origem',
      destination: r.destination ?? 'Destino',
      departureTime: depIso,
      returnTime: retIso,
      transportType: fleetTypeLabel(r.fleet_type),
      responsible,
      direction: 'Ida',
      status: r.status ?? 'pending',
      originLat: null,
      originLng: null,
      destLat: null,
      destLng: null,
      createdAt: r.created_at ?? null,
      confirmedAt: r.confirmed_at ?? null,
      clientPhone,
      clientUserId: r.user_id as string,
      clientAvatarUrl,
      registeredPassengerCount: psgCount ?? 0,
    });
    setLoading(false);
  }, [excursionId]);

  useEffect(() => { load(); }, [load]);

  // GPS: última posição + fix atual + atualizações periódicas (mapa “começa em você”).
  useEffect(() => {
    if (!Location) return;
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    function applyPosition(longitude: number, latitude: number) {
      const pair = validCoordPair(longitude, latitude);
      if (pair && !cancelled) setUserLngLat(pair);
    }

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;

        try {
          const last = await Location.getLastKnownPositionAsync({});
          if (last?.coords) {
            applyPosition(last.coords.longitude, last.coords.latitude);
          }
        } catch {
          /* sem cache */
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy?.Balanced ?? 3,
        });
        if (!cancelled && pos?.coords) {
          applyPosition(pos.coords.longitude, pos.coords.latitude);
        }

        if (cancelled) return;
        try {
          subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy?.Balanced ?? 3,
              timeInterval: 6000,
              distanceInterval: 30,
            },
            (loc: { coords: { longitude: number; latitude: number } }) => {
              applyPosition(loc.coords.longitude, loc.coords.latitude);
            },
          );
        } catch {
          /* watch indisponível */
        }
      } catch {
        /* GPS desligado / timeout */
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  const openResponsibleChat = useCallback(async () => {
    if (!detail?.clientUserId) {
      Alert.alert('Chat', 'Não foi possível identificar o cliente desta excursão.');
      return;
    }
    setOpeningChat(true);
    const res = await ensureExcursionClientConversation({
      clientUserId: detail.clientUserId,
      participantName: detail.responsible,
      participantAvatar: detail.clientAvatarUrl,
    });
    setOpeningChat(false);
    if ('error' in res) {
      Alert.alert('Chat', res.error);
      return;
    }
    navigateExcursionTabToChatThread(navigation, {
      conversationId: res.conversationId,
      participantName: detail.responsible,
      participantAvatar: detail.clientAvatarUrl ?? undefined,
    });
  }, [detail, navigation]);

  const destCoord = useMemo(() => {
    if (!detail || detail.destLat == null || detail.destLng == null) return null;
    return toLngLatPair({ latitude: detail.destLat, longitude: detail.destLng });
  }, [detail?.destLat, detail?.destLng, detail?.id]);

  const originCoord = useMemo(() => {
    if (!detail || detail.originLat == null || detail.originLng == null) return null;
    return toLngLatPair({ latitude: detail.originLat, longitude: detail.originLng });
  }, [detail?.originLat, detail?.originLng, detail?.id]);

  useEffect(() => {
    setGeocodedDestCoord(null);
    if (!detail?.destination?.trim() || destCoord) return;
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) return;
    let cancelled = false;
    const q = `${detail.destination.trim()}, Brasil`;
    (async () => {
      const geo = await googleForwardGeocode(q, apiKey);
      if (cancelled || !geo) return;
      const pair = toLngLatPair({ latitude: geo.latitude, longitude: geo.longitude });
      if (pair) setGeocodedDestCoord(pair);
    })();
    return () => {
      cancelled = true;
    };
  }, [detail?.id, detail?.destination, destCoord]);

  useEffect(() => {
    setGeocodedOriginCoord(null);
    const o = detail?.origin?.trim();
    if (!o || o === 'Origem' || o.length < 2 || originCoord) return;
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) return;
    let cancelled = false;
    const q = `${o}, Brasil`;
    (async () => {
      const geo = await googleForwardGeocode(q, apiKey);
      if (cancelled || !geo) return;
      const pair = toLngLatPair({ latitude: geo.latitude, longitude: geo.longitude });
      if (pair) setGeocodedOriginCoord(pair);
    })();
    return () => {
      cancelled = true;
    };
  }, [detail?.id, detail?.origin, originCoord]);

  const resolvedDestCoord = destCoord ?? geocodedDestCoord;
  const resolvedOriginCoord = originCoord ?? geocodedOriginCoord;

  const mapPoints = useMemo(
    () => collectMapPoints(userLngLat, resolvedDestCoord, resolvedOriginCoord),
    [userLngLat, resolvedDestCoord, resolvedOriginCoord],
  );

  /** Cantos da bbox da rota — enquadra a linha inteira (equivalente a fitBounds). */
  const routeFitSamples = useMemo((): [number, number][] => {
    if (routeCoords.length < 2) return [];
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const c of routeCoords) {
      const lng = parseFloat(String(c.longitude));
      const lat = parseFloat(String(c.latitude));
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    if (!Number.isFinite(minLng)) return [];
    return [
      [minLng, minLat],
      [minLng, maxLat],
      [maxLng, minLat],
      [maxLng, maxLat],
    ];
  }, [routeCoords]);

  const cameraFitPoints = useMemo(
    () => mergeLngLatPointsForCamera(mapPoints, routeFitSamples),
    [mapPoints, routeFitSamples],
  );

  const applyCameraRef = useMapCameraApply(excursionMapRef, {
    fitPoints: cameraFitPoints,
    hasRoutePolyline: routeCoords.length >= 2,
    userLngLat,
    safeCenter: safeMapCenter,
    fallbackCenter: DEFAULT_COORD,
  });

  const applyCameraIfNotFollowing = useCallback(() => {
    if (followRef.current) return;
    applyCameraRef.current();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      applyCameraIfNotFollowing();
      requestAnimationFrame(() => applyCameraIfNotFollowing());
    }, 80);
    return () => clearTimeout(t);
  }, [cameraFitPoints, routeCoords.length, applyCameraIfNotFollowing]);

  /** Toque em “minha localização”: zoom alto e câmera segue o GPS até gesto no mapa. */
  useEffect(() => {
    if (!followMyLocation) {
      followFirstAnimDoneRef.current = false;
      return;
    }
    if (!userLngLat) return;
    const [lng, lat] = userLngLat;
    if (!isValidGlobeCoordinate(lat, lng)) return;
    const dur = followFirstAnimDoneRef.current ? 0 : 350;
    followFirstAnimDoneRef.current = true;
    excursionMapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lng,
        latitudeDelta: MY_LOCATION_NAV_DELTA,
        longitudeDelta: MY_LOCATION_NAV_DELTA,
      },
      dur,
    );
  }, [userLngLat, followMyLocation]);

  // Rota no mapa: OSRM público (mesmo padrão do ActiveTrip). origem→destino do pedido, ou você→destino.
  useEffect(() => {
    if (!detail) {
      setRouteCoords([]);
      setRouteEtaSec(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const user = userLngLat ? toLatLng(userLngLat) : null;
      const dest = resolvedDestCoord ? toLatLng(resolvedDestCoord) : null;
      const origin = resolvedOriginCoord ? toLatLng(resolvedOriginCoord) : null;

      const routeOpts = { mapboxToken: getMapboxAccessToken(), googleMapsApiKey: getGoogleMapsApiKey() };
      let result = null;
      if (origin && dest) {
        result = await getRouteWithDuration(origin, dest, routeOpts);
      } else if (user && dest) {
        result = await getRouteWithDuration(user, dest, routeOpts);
      } else if (user && origin) {
        result = await getRouteWithDuration(user, origin, routeOpts);
      }

      if (cancelled) return;
      if (result?.coordinates?.length) {
        setRouteCoords(result.coordinates);
        setRouteEtaSec(result.durationSeconds ?? null);
      } else {
        setRouteCoords([]);
        setRouteEtaSec(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detail?.id, userLngLat, resolvedDestCoord, resolvedOriginCoord]);

  const cameraInitialCenter = useMemo(
    () => safeMapCenter(userLngLat ?? resolvedDestCoord ?? resolvedOriginCoord ?? DEFAULT_COORD),
    [userLngLat, resolvedDestCoord, resolvedOriginCoord],
  );
  const cameraInitialZoom = useMemo(() => {
    if (userLngLat) return 14;
    if (resolvedDestCoord || resolvedOriginCoord) return 11;
    return 11;
  }, [userLngLat, resolvedDestCoord, resolvedOriginCoord]);

  /** Região inicial para o mapa (mesmo centro que a câmera usava; deltas coerentes com o zoom). */
  const excursionMapRegion = useMemo((): MapRegion => {
    const lat = cameraInitialCenter[1];
    const lng = cameraInitialCenter[0];
    const z = cameraInitialZoom;
    const delta = Math.max(0.008 * 2 ** (14 - z), 0.02);
    return {
      latitude: lat,
      longitude: lng,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
  }, [cameraInitialCenter, cameraInitialZoom]);

  const mapIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMapIdle = useCallback(() => {
    if (mapIdleTimerRef.current) clearTimeout(mapIdleTimerRef.current);
    mapIdleTimerRef.current = setTimeout(() => {
      mapIdleTimerRef.current = null;
      applyCameraIfNotFollowing();
    }, 120);
  }, [applyCameraIfNotFollowing]);

  useEffect(
    () => () => {
      if (mapIdleTimerRef.current) clearTimeout(mapIdleTimerRef.current);
    },
    [],
  );

  const cfg = detail ? statusCfg(detail.status) : DEFAULT_STATUS;
  const steps = detail ? timelineSteps(detail.status) : [true, false, false, false];
  const timelineSubs = detail ? timelineSubtitlesForDetail(detail) : ['—', '—', '—', '—'];
  const canBoardingActions = detail ? BOARDING_ACTION_STATUSES.includes(detail.status) : false;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : undefined)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
        </View>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Detalhes da excursão</Text>
        </View>
        <View style={styles.headerSide}>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <MaterialIcons name="notifications-none" size={22} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#111827" style={{ marginTop: 48 }} />
      ) : !detail ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="error-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>Excursão não encontrada</Text>
        </View>
      ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
          {/* mapa → card (detalhes + timeline + ações dentro da mesma borda) */}
          <View style={styles.mapOuter}>
          <View style={[styles.mapWrap, { height: MAP_HEIGHT }]}>
            {getGoogleMapsApiKey() ? (
              <>
              <GoogleMapsMap
                ref={excursionMapRef}
                style={{ flex: 1 }}
                initialRegion={excursionMapRegion}
                compassEnabled={false}
                showsUserLocation
                onDidFinishLoadingMap={() => applyCameraIfNotFollowing()}
                onDidFinishLoadingStyle={() => applyCameraIfNotFollowing()}
                onMapIdle={onMapIdle}
                onUserAdjustedMap={() => setFollowMyLocation(false)}
              >
                {[
                  ...(routeCoords.length >= 2
                    ? [
                        <MapPolyline
                          key="exc-route"
                          id="exc-route"
                          coordinates={routeCoords}
                          strokeColor="#C9A227"
                          strokeWidth={4}
                        />,
                      ]
                    : []),
                  ...(resolvedDestCoord
                    ? [
                        <MapMarker
                          key="exc-dest"
                          id="exc-dest"
                          coordinate={toLatLng(resolvedDestCoord)}
                          anchor={{ x: 0.5, y: 1 }}
                        >
                          <View style={styles.destPill}>
                            <MaterialIcons name="place" size={14} color="#111827" />
                            <Text style={styles.destPillText} numberOfLines={1}>{detail.destination}</Text>
                          </View>
                        </MapMarker>,
                      ]
                    : []),
                  ...(resolvedOriginCoord
                    ? [
                        <MapMarker
                          key="exc-origin"
                          id="exc-origin"
                          coordinate={toLatLng(resolvedOriginCoord)}
                          anchor={{ x: 0.5, y: 1 }}
                        >
                          <View style={styles.originPill}>
                            <MaterialIcons name="trip-origin" size={14} color="#92400E" />
                            <Text style={styles.originPillText} numberOfLines={1}>{detail.origin}</Text>
                          </View>
                        </MapMarker>,
                      ]
                    : []),
                ]}
              </GoogleMapsMap>
              <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
                <TouchableOpacity
                  style={[styles.excMapFab, { top: 10, left: 10 }]}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (!userLngLat) return;
                    const [lng, lat] = userLngLat;
                    if (!isValidGlobeCoordinate(lat, lng)) return;
                    setFollowMyLocation(true);
                  }}
                  disabled={!userLngLat}
                >
                  <MaterialIcons name="my-location" size={22} color="#111827" />
                </TouchableOpacity>
                <MapZoomControls
                  mapRef={excursionMapRef}
                  floating
                  onBeforeZoom={() => setFollowMyLocation(false)}
                />
              </View>
              {routeEtaSec != null && routeCoords.length >= 2 ? (
                <View style={styles.mapEtaPill} pointerEvents="none">
                  <MaterialIcons name="schedule" size={14} color="#111827" />
                  <Text style={styles.mapEtaText}>~{formatEta(routeEtaSec)} de percurso estimado</Text>
                </View>
              ) : null}
              </>
            ) : (
              <View style={styles.mapFallback}>
                <MaterialIcons name="map" size={40} color="#C9B87A" />
                <Text style={styles.mapFallbackText}>{detail.destination}</Text>
                <Text style={styles.mapFallbackHint}>
                  Defina EXPO_PUBLIC_GOOGLE_MAPS_API_KEY no .env (raiz do repo), rode expo prebuild e reinicie o Metro.
                </Text>
              </View>
            )}
          </View>
          </View>

            <View style={[styles.card, styles.cardAfterMap, { borderColor: CARD_GOLD }]}>
              <View style={styles.cardTopRow}>
                <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
                </View>
                <TouchableOpacity onPress={() => setCardExpanded((e) => !e)} hitSlop={12} activeOpacity={0.7}>
                  <MaterialIcons
                    name={cardExpanded ? 'expand-less' : 'expand-more'}
                    size={22}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>

              {cardExpanded ? (
                <>
                  <View style={styles.routeRow}>
                    <Text style={styles.routeCity}>{detail.origin}</Text>
                    <MaterialIcons name="arrow-forward" size={16} color={CARD_GOLD} style={{ marginHorizontal: 8 }} />
                    <Text style={[styles.routeCity, { textAlign: 'right', flex: 1 }]}>{detail.destination}</Text>
                  </View>

                  <View style={styles.datesRow}>
                    <Text style={styles.dateLabel}>{formatDateLabel(detail.departureTime, 'ida')}</Text>
                    {detail.returnTime ? (
                      <>
                        <Text style={styles.dateSep}> | </Text>
                        <Text style={styles.dateLabel}>{formatDateLabel(detail.returnTime, 'retorno')}</Text>
                      </>
                    ) : null}
                  </View>

                  <View style={styles.detailsSection}>
                    <DetailRow
                      label="Passageiros totais"
                      value={passengerTotalLabel(detail.registeredPassengerCount)}
                    />
                    <DetailRow label="Tipo de transporte" value={detail.transportType} />
                    <DetailRow label="Responsável" value={detail.responsible} />
                    <DetailRow label="Navegação" value={detail.direction} isLast />
                  </View>

                  {canBoardingActions ? (
                    <TouchableOpacity
                      style={styles.whatsappRow}
                      onPress={() => void openResponsibleChat()}
                      activeOpacity={0.85}
                      disabled={openingChat}
                    >
                      {openingChat ? (
                        <ActivityIndicator size="small" color="#111827" />
                      ) : (
                        <MaterialIcons name="chat" size={22} color="#111827" />
                      )}
                      <Text style={styles.whatsappText}>Contato do responsável</Text>
                    </TouchableOpacity>
                  ) : null}

                  <View style={styles.historicoDivider} />
                  <Text style={styles.historicoTitle}>Histórico</Text>
                  {TIMELINE_LABELS.map((label, idx) => (
                    <TimelineStep
                      key={label}
                      label={label}
                      subtitle={timelineSubs[idx] ?? '—'}
                      done={steps[idx] ?? false}
                      isLast={idx === TIMELINE_LABELS.length - 1}
                    />
                  ))}
                </>
              ) : null}
            </View>
          </ScrollView>
      )}
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.detailRowOuter, isLast ? undefined : styles.detailRowSeparator]}>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={3}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function TimelineStep({
  label,
  subtitle,
  done,
  isLast,
}: {
  label: string;
  subtitle: string;
  done: boolean;
  isLast: boolean;
}) {
  return (
    <View style={tlStyles.row}>
      <View style={tlStyles.dotCol}>
        <View style={[tlStyles.dot, done ? tlStyles.dotDone : tlStyles.dotPending]} />
        {!isLast && <View style={[tlStyles.line, done ? tlStyles.lineDone : tlStyles.linePending]} />}
      </View>
      <View style={tlStyles.content}>
        <Text style={[tlStyles.label, done ? tlStyles.labelDone : tlStyles.labelPending]}>{label}</Text>
        <Text style={[tlStyles.subtitle, done ? tlStyles.subtitleDone : tlStyles.subtitlePending]}>{subtitle}</Text>
      </View>
    </View>
  );
}

const tlStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  dotCol: { alignItems: 'center', width: 16 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  dotDone: { backgroundColor: '#111827' },
  dotPending: { backgroundColor: '#D1D5DB' },
  line: { flex: 1, width: 2, minHeight: 20, marginTop: 4 },
  lineDone: { backgroundColor: '#111827' },
  linePending: { backgroundColor: '#E5E7EB' },
  content: { flex: 1, paddingBottom: 20 },
  label: { fontSize: 14, fontWeight: '600' },
  labelDone: { color: '#111827' },
  labelPending: { color: '#9CA3AF' },
  subtitle: { fontSize: 13, marginTop: 4 },
  subtitleDone: { color: '#374151' },
  subtitlePending: { color: '#9CA3AF' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8 + SCREEN_TOP_EXTRA_PADDING,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerSide: { width: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },

  mapOuter: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  mapWrap: { width: '100%', backgroundColor: '#F0EDE8', position: 'relative' },
  excMapFab: {
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
  mapEtaPill: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  mapEtaText: { fontSize: 12, color: '#374151', flex: 1 },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  mapFallbackText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
  mapFallbackHint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },

  destPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFFFFF', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 3, maxWidth: 180,
  },
  destPillText: { fontSize: 12, fontWeight: '700', color: '#111827', flexShrink: 1 },

  originPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEF3C7', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 2, maxWidth: 160,
  },
  originPillText: { fontSize: 12, fontWeight: '600', color: '#92400E', flexShrink: 1 },

  cardAfterMap: { marginTop: 16 },

  card: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statusPill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  statusText: { fontSize: 13, fontWeight: '700' },

  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  routeCity: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },

  datesRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 },
  dateLabel: { fontSize: 13, color: '#6B7280' },
  dateSep: { fontSize: 13, color: '#D1D5DB' },

  detailsSection: { paddingTop: 2 },
  detailRowOuter: { width: '100%' },
  detailRowSeparator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
    maxWidth: '42%',
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    lineHeight: 20,
  },

  historicoDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 16,
    marginBottom: 16,
  },
  historicoTitle: { fontSize: 15, fontWeight: '700', color: '#6B7280', marginBottom: 16 },
  whatsappRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FEF9C3',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
  },
  whatsappText: { fontSize: 15, fontWeight: '700', color: '#111827' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },
});
