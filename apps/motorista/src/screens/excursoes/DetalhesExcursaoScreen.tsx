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
import { getGoogleMapsApiKey, getMapboxAccessToken } from '../../lib/googleMapsConfig';
import {
  GoogleMapsMap,
  MapMarker,
  MapPolyline,
  latLngFromDbColumns,
  mergeLngLatPointsForCamera,
  toLngLatPair,
  useMapCameraApply,
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
  passengerCount: number;
  transportType: string;
  responsible: string;
  direction: string;
  status: string;
  originLat: number | null;
  originLng: number | null;
  destLat: number | null;
  destLng: number | null;
};

type StatusConfig = { label: string; bg: string; text: string; border: string };

const STATUS_MAP: Record<string, StatusConfig> = {
  contacted:      { label: 'Em andamento',       bg: '#FEF3C7', text: '#92400E', border: '#C9A227' },
  in_progress:    { label: 'Em andamento',       bg: '#FEF3C7', text: '#92400E', border: '#C9A227' },
  active:         { label: 'Em andamento',       bg: '#FEF3C7', text: '#92400E', border: '#C9A227' },
  payment_done:   { label: 'Pagamento realizado', bg: '#DBEAFE', text: '#1E40AF', border: '#E5E7EB' },
  paid:           { label: 'Pagamento realizado', bg: '#DBEAFE', text: '#1E40AF', border: '#E5E7EB' },
  pending_rating: { label: 'Avaliação Pendente', bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
  confirmed:      { label: 'Concluído',          bg: '#D1FAE5', text: '#065F46', border: '#E5E7EB' },
  completed:      { label: 'Concluído',          bg: '#D1FAE5', text: '#065F46', border: '#E5E7EB' },
  cancelled:      { label: 'Cancelado',          bg: '#FEE2E2', text: '#991B1B', border: '#E5E7EB' },
};

const DEFAULT_STATUS: StatusConfig = { label: 'Pendente', bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' };

function statusCfg(status: string): StatusConfig {
  return STATUS_MAP[status] ?? DEFAULT_STATUS;
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

function timelineSteps(status: string): boolean[] {
  const paymentStatuses = ['payment_done', 'paid', 'pending_rating', 'confirmed', 'completed'];
  const confirmedStatuses = ['confirmed', 'completed'];
  const departedStatuses = ['completed'];
  return [
    true,
    paymentStatuses.includes(status),
    confirmedStatuses.includes(status),
    departedStatuses.includes(status),
  ];
}

const TIMELINE_LABELS = ['Pedido feito', 'Pagamento aprovado', 'Embarque confirmado', 'Ônibus partiu'];
const ACCEPTABLE_STATUSES = ['contacted', 'in_progress', 'active'];

export function DetalhesExcursaoScreen({ navigation, route }: Props) {
  const { excursionId } = route.params;
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [detail, setDetail] = useState<ExcursionDetail | null>(null);
  const [userLngLat, setUserLngLat] = useState<[number, number] | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [routeEtaSec, setRouteEtaSec] = useState<number | null>(null);
  /** Fallback quando o pedido só tem texto de destino (sem destination_lat no banco). */
  const [geocodedDestCoord, setGeocodedDestCoord] = useState<[number, number] | null>(null);
  /** Fallback para origem só em texto (sem origin_lat no banco). */
  const [geocodedOriginCoord, setGeocodedOriginCoord] = useState<[number, number] | null>(null);
  const excursionMapRef = useRef<GoogleMapsMapRef>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('excursion_requests')
      .select(
        'id, origin, destination, excursion_date, departure_time, return_time, return_date, people_count, fleet_type, responsible_name, direction, status, user_id, origin_lat, origin_lng, destination_lat, destination_lng',
      )
      .eq('id', excursionId)
      .maybeSingle();

    if (!data) { setLoading(false); return; }
    const r = data as any;

    let responsible = r.responsible_name ?? null;
    if (!responsible) {
      const { data: prof } = await supabase
        .from('profiles').select('full_name').eq('id', r.user_id).maybeSingle();
      responsible = (prof as any)?.full_name ?? 'Cliente';
    }

    const depIso = r.departure_time ?? r.excursion_date ?? null;
    const retIso = r.return_time ?? r.return_date ?? null;

    const originLL = latLngFromDbColumns(r.origin_lat, r.origin_lng);
    const destLL = latLngFromDbColumns(r.destination_lat, r.destination_lng);

    setDetail({
      id: r.id,
      origin: r.origin ?? 'Origem',
      destination: r.destination ?? 'Destino',
      departureTime: depIso,
      returnTime: retIso,
      passengerCount: r.people_count ?? 0,
      transportType: r.fleet_type ?? 'Van',
      responsible,
      direction: r.direction ?? 'Ida',
      status: r.status ?? 'pending',
      originLat: originLL?.latitude ?? null,
      originLng: originLL?.longitude ?? null,
      destLat: destLL?.latitude ?? null,
      destLng: destLL?.longitude ?? null,
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

  const handleAccept = useCallback(async () => {
    if (!detail) return;
    setAccepting(true);
    const { error } = await supabase
      .from('excursion_requests')
      .update({ status: 'payment_done', confirmed_at: new Date().toISOString() })
      .eq('id', detail.id);

    if (error) {
      Alert.alert('Erro', 'Não foi possível aceitar a excursão. Tente novamente.');
      setAccepting(false);
      return;
    }
    setAccepting(false);
    await load();
  }, [detail, load]);

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

  useEffect(() => {
    const t = setTimeout(() => {
      applyCameraRef.current();
      requestAnimationFrame(() => applyCameraRef.current());
    }, 80);
    return () => clearTimeout(t);
  }, [cameraFitPoints, routeCoords.length]);

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
      applyCameraRef.current();
    }, 120);
  }, []);

  useEffect(
    () => () => {
      if (mapIdleTimerRef.current) clearTimeout(mapIdleTimerRef.current);
    },
    [],
  );

  const cfg = detail ? statusCfg(detail.status) : DEFAULT_STATUS;
  const steps = detail ? timelineSteps(detail.status) : [true, false, false, false];
  const canAccept = detail ? ACCEPTABLE_STATUSES.includes(detail.status) : false;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : undefined}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes da Excursão</Text>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
          <MaterialIcons name="notifications-none" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#111827" style={{ marginTop: 48 }} />
      ) : !detail ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="error-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>Excursão não encontrada</Text>
        </View>
      ) : (
        <>
          {/* Map */}
          <View style={[styles.mapWrap, { height: MAP_HEIGHT }]}>
            {getGoogleMapsApiKey() ? (
              <>
              <GoogleMapsMap
                ref={excursionMapRef}
                style={{ flex: 1 }}
                initialRegion={excursionMapRegion}
                compassEnabled={false}
                showsUserLocation
                onDidFinishLoadingMap={() => applyCameraRef.current()}
                onDidFinishLoadingStyle={() => applyCameraRef.current()}
                onMapIdle={onMapIdle}
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

          {/* Scrollable content */}
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* Status card */}
            <View style={[styles.card, { borderColor: cfg.border }]}>
              <View style={styles.cardTopRow}>
                <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
                </View>
              </View>

              {/* Route */}
              <View style={styles.routeRow}>
                <Text style={styles.routeCity}>{detail.origin}</Text>
                <MaterialIcons name="arrow-forward" size={16} color="#374151" style={{ marginHorizontal: 8 }} />
                <Text style={[styles.routeCity, { textAlign: 'right', flex: 1 }]}>{detail.destination}</Text>
              </View>

              {/* Dates */}
              <View style={styles.datesRow}>
                <Text style={styles.dateLabel}>{formatDateLabel(detail.departureTime, 'ida')}</Text>
                {detail.returnTime ? (
                  <>
                    <Text style={styles.dateSep}> | </Text>
                    <Text style={styles.dateLabel}>{formatDateLabel(detail.returnTime, 'retorno')}</Text>
                  </>
                ) : null}
              </View>

              {/* Detail rows */}
              <View style={styles.detailsSection}>
                <DetailRow label="Passageiros" value={`${detail.passengerCount} passageiros`} />
                <DetailRow label="Tipo de transporte" value={detail.transportType} />
                <DetailRow label="Responsável" value={detail.responsible} />
                <DetailRow label="Navegação" value={detail.direction} />
              </View>
            </View>

            {/* Histórico */}
            <View style={styles.historicoCard}>
              <Text style={styles.historicoTitle}>Histórico</Text>
              {TIMELINE_LABELS.map((label, idx) => (
                <TimelineStep
                  key={label}
                  label={label}
                  done={steps[idx] ?? false}
                  isLast={idx === TIMELINE_LABELS.length - 1}
                />
              ))}
            </View>

          </ScrollView>

          {/* Bottom buttons */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.btnVoltar}
              onPress={() => navigation.canGoBack() ? navigation.goBack() : undefined}
              activeOpacity={0.7}
            >
              <Text style={styles.btnVoltarText}>Voltar</Text>
            </TouchableOpacity>

            {canAccept && (
              <TouchableOpacity
                style={[styles.btnAceitar, accepting && { opacity: 0.6 }]}
                onPress={handleAccept}
                activeOpacity={0.8}
                disabled={accepting}
              >
                {accepting
                  ? <ActivityIndicator size="small" color="#111827" />
                  : <Text style={styles.btnAceitarText}>Aceitar excursão</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function TimelineStep({ label, done, isLast }: { label: string; done: boolean; isLast: boolean }) {
  return (
    <View style={tlStyles.row}>
      <View style={tlStyles.dotCol}>
        <View style={[tlStyles.dot, done ? tlStyles.dotDone : tlStyles.dotPending]} />
        {!isLast && <View style={[tlStyles.line, done ? tlStyles.lineDone : tlStyles.linePending]} />}
      </View>
      <View style={tlStyles.content}>
        <Text style={[tlStyles.label, done ? tlStyles.labelDone : tlStyles.labelPending]}>{label}</Text>
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
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8 + SCREEN_TOP_EXTRA_PADDING,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },

  mapWrap: { width: '100%', backgroundColor: '#F0EDE8', position: 'relative' },
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

  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },

  card: {
    borderWidth: 1.5, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 16, backgroundColor: '#FFFFFF',
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusPill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  statusText: { fontSize: 13, fontWeight: '700' },

  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  routeCity: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },

  datesRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
  dateLabel: { fontSize: 13, color: '#6B7280' },
  dateSep: { fontSize: 13, color: '#D1D5DB' },

  detailsSection: { gap: 8, paddingTop: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailLabel: { fontSize: 14, color: '#9CA3AF' },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '500', textAlign: 'right' },

  historicoCard: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
    backgroundColor: '#FFFFFF',
  },
  historicoTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 20 },

  bottomBar: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  btnVoltar: {
    flex: 1, height: 50, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  btnVoltarText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  btnAceitar: {
    flex: 2, height: 50, borderRadius: 14,
    backgroundColor: '#F5D06E',
    alignItems: 'center', justifyContent: 'center',
  },
  btnAceitarText: { fontSize: 15, fontWeight: '700', color: '#111827' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },
});
