import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Clipboard,
  Share,
} from 'react-native';
import { Text } from '../../components/Text';
import { DriverLocationFocusButton } from '../../components/DriverLocationFocusButton';
import { MapNetworkBadge } from '../../components/MapNetworkBadge';
import { SmoothDriverMapMarker } from '../../components/SmoothDriverMapMarker';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useRouteOfflinePack } from '../../hooks/useRouteOfflinePack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ColetasEncomendasStackParamList } from '../../navigation/ColetasEncomendasStack';
import { supabase } from '../../lib/supabase';
import {
  GoogleMapsMap,
  MapMarker,
  MapPolyline,
  MapZoomControls,
  latLngFromDbColumns,
  regionFromLatLngPoints,
  isValidGlobeCoordinate,
  MY_LOCATION_NAV_DELTA,
  type GoogleMapsMapRef,
  type LatLng,
} from '../../components/googleMaps';
import { getGoogleMapsApiKey, getMapboxAccessToken } from '../../lib/googleMapsConfig';
import {
  buildNavigationPadding,
  computeNextNavigationCamera,
  createInitialBearingState,
  type DriverFix,
  type NavigationBearingState,
} from '../../lib/navigationCamera';
import { snapToRoutePolyline, trimPolylineFromSnap } from '../../lib/routeSnap';
import { getRouteWithDuration, formatEta } from '../../lib/route';
import { useAppAlert } from '../../contexts/AppAlertContext';
import {
  assertPreparerShipmentsForShipment,
  coletaLetterFromShipmentId,
  resolveShipmentBaseIdForPreparerScreen,
  shipmentCodesMatch,
} from '../../lib/preparerEncomendasBase';
import { onlyDigits } from '../../utils/formatCpf';
import { closeShipmentConversation } from '../../lib/shipmentConversation';
import { getUserErrorMessage, isShipmentDriverRatingsUnavailableError } from '../../utils/errorMessage';

let Location: any = null;
try { Location = require('expo-location'); } catch { /* not linked yet */ }

/** Map matching / bearing da via (igual ActiveTrip). */
const NAV_ROUTE_SNAP_MAX_M = 52;
const NAV_ROAD_BEARING_SNAP_M = 40;
const NAV_LOOK_AHEAD_M = 56;
const NAV_CAMERA_ANIMATION_MS = 320;

const GOLD = '#C9A227';
const DARK = '#111827';

type Props = NativeStackScreenProps<ColetasEncomendasStackParamList, 'ActiveShipment'>;
type Coord = { latitude: number; longitude: number };
type Step = 'to_pickup' | 'to_delivery';

type Shipment = {
  id: string;
  clientName: string;
  originAddress: string;
  /** Destino final do pacote (motorista entrega ao destinatário; preparador com base só vê na rota até a base). */
  finalDestinationAddress: string;
  baseAddress: string;
  baseName: string;
  originCoord: Coord;
  baseCoord: Coord;
  destinationCoord: Coord;
  /** 1ª parada: coleta (sempre no endereço de origem / cliente). */
  pickupCoord: Coord;
  /** 2ª parada: com base Take Me, depósito na base; sem base, entrega no destino final. */
  deliveryCoord: Coord;
  hasPreparerBase: boolean;
  /** Coleta com coordenadas confiáveis (modal por proximidade na 1ª etapa). */
  pickupHasMapCoords: boolean;
  /** Se false, `baseCoord` é só fallback para o mapa (ex.: base sem lat/lng). */
  baseHasMapCoords: boolean;
  /** Destino com coordenadas válidas (modal de entrega por proximidade). */
  deliveryHasMapCoords: boolean;
  amountCents: number;
  confirmedAt: string;
  /** PDF cenário 4 (sem base): `pickup_code` que o motorista digita. */
  pickupCodeExpected: string;
  /** PDF cenário 4 (sem base): `delivery_code` que o motorista digita ao entregar. */
  deliveryCodeExpected: string;
  /** PDF cenário 3 (com base): PIN A (passageiro valida no app cliente). */
  passengerToPreparerCode: string;
  /** PDF cenário 3 (com base): PIN B (preparador valida ao chegar na base). */
  preparerToBaseCode: string;
  /** PDF cenário 3 (com base): timestamp do handoff Passageiro → Preparador. */
  pickedUpByPreparerAt: string | null;
  coletaLetter: string;
};

function pinCharsForDisplay(code: string | null | undefined): string[] {
  const s = (code ?? '').trim();
  if (!s) return ['-', '-', '-', '-'];
  return s.split('').slice(0, 4);
}

function haversineKm(a: Coord, b: Coord): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function routeDistanceKm(coords: Coord[]): number {
  let d = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    d += haversineKm(coords[i]!, coords[i + 1]!);
  }
  return d;
}

/** ~150 m — abre modais de código ao aproximar da coleta ou da base. */
const NEARBY_KM = 0.15;

export function ActiveShipmentScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { showAlert } = useAppAlert();
  const { shipmentId } = route.params;
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('to_pickup');
  const [driverPos, setDriverPos] = useState<Coord | null>(null);
  const [fullRouteCoords, setFullRouteCoords] = useState<Coord[]>([]);
  const [driverRouteCoords, setDriverRouteCoords] = useState<Coord[]>([]);
  const [etaSeconds, setEtaSeconds] = useState(0);

  // Mapa offline + indicador de rede. Hooks ficam no topo (regras de Hooks):
  // não podem rodar depois de early returns abaixo.
  const { online: isOnline } = useNetworkStatus();
  const offlinePackCoords = useMemo<Coord[]>(() => {
    if (fullRouteCoords.length >= 2) return fullRouteCoords;
    if (shipment?.pickupCoord && shipment?.deliveryCoord) {
      return [shipment.pickupCoord, shipment.deliveryCoord];
    }
    return [];
  }, [fullRouteCoords, shipment?.pickupCoord, shipment?.deliveryCoord]);
  useRouteOfflinePack({
    packName: shipment?.id ? `shipment-${shipment.id}` : null,
    coords: offlinePackCoords,
  });

  // Pickup modal
  const [pickupVisible, setPickupVisible] = useState(false);
  const [pickupCode, setPickupCode] = useState('');
  const [pickupObs, setPickupObs] = useState('');
  const [pickupLoading, setPickupLoading] = useState(false);

  // Delivery modal
  const [deliveryVisible, setDeliveryVisible] = useState(false);
  const [deliveryCode, setDeliveryCode] = useState('');
  const [deliveryObs, setDeliveryObs] = useState('');
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  /** Com base: por defeito o admin valida PIN B; fallback para o preparador digitar (RPC). */
  const [deliveryPinManual, setDeliveryPinManual] = useState(false);

  // Summary modal
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  const mapRef = useRef<GoogleMapsMapRef>(null);
  const locationSubRef = useRef<any>(null);
  const autoModalRef = useRef({ pickup: false, delivery: false });
  const startTimeRef = useRef(Date.now());
  const [followMyLocation, setFollowMyLocation] = useState(false);
  const followNavRef = useRef(false);
  const latestDriverFixRef = useRef<DriverFix | null>(null);
  const compassHeadingRef = useRef<number | null>(null);
  const navBearingStateRef = useRef<NavigationBearingState | null>(null);
  const navRafRef = useRef<number | null>(null);
  const routeForSnapRef = useRef<LatLng[]>([]);

  const navPuckTopPx = useMemo(() => Math.round(windowHeight * 0.68 - 24), [windowHeight]);

  const mapInitialRegion = useMemo(() => {
    if (!shipment) return regionFromLatLngPoints([]);
    if (step === 'to_pickup') {
      const pts: Coord[] = [shipment.pickupCoord];
      if (driverPos) pts.push(driverPos);
      return regionFromLatLngPoints(pts);
    }
    const pts: Coord[] = [];
    if (driverPos) pts.push(driverPos);
    pts.push(shipment.pickupCoord, shipment.deliveryCoord);
    return regionFromLatLngPoints(pts);
  }, [shipment, driverPos, step]);

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

  /** Ao mudar etapa: coleta → zoom no ponto de coleta; entrega → rota entre coleta e destino. */
  useEffect(() => {
    if (!shipment || loading) return;
    setFollowMyLocation(false);
    const region =
      step === 'to_pickup'
        ? {
            latitude: shipment.pickupCoord.latitude,
            longitude: shipment.pickupCoord.longitude,
            latitudeDelta: 0.052,
            longitudeDelta: 0.052,
          }
        : regionFromLatLngPoints([shipment.pickupCoord, shipment.deliveryCoord]);
    const t = setTimeout(() => mapRef.current?.animateToRegion(region, 450), 100);
    return () => clearTimeout(t);
  }, [step, shipment, loading]);

  // Load shipment: com base → coleta na base e entrega no destino; sem base → coleta na origem (cliente).
  useEffect(() => {
    autoModalRef.current = { pickup: false, delivery: false };
    setLoadError(null);
    setShipment(null);
    setFullRouteCoords([]);
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('shipments')
        .select(
          'id, origin_address, destination_address, origin_lat, origin_lng, destination_lat, destination_lng, amount_cents, created_at, status, user_id, base_id, pickup_code, delivery_code, picked_up_at, passenger_to_preparer_code, preparer_to_base_code, picked_up_by_preparer_at',
        )
        .eq('id', shipmentId)
        .maybeSingle();

      if (!data) {
        setLoading(false);
        setLoadError('Encomenda não encontrada.');
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setLoading(false);
        setLoadError('Sessão inválida. Faça login novamente.');
        return;
      }

      const access = await assertPreparerShipmentsForShipment({
        userId: user.id,
        shipmentBaseId: (data as { base_id?: string | null }).base_id ?? null,
      });
      if (!access.ok) {
        setLoading(false);
        setLoadError(access.message);
        return;
      }

      const row = data as {
        id: string;
        origin_address: string | null;
        destination_address: string | null;
        origin_lat: number | null;
        origin_lng: number | null;
        destination_lat: number | null;
        destination_lng: number | null;
        amount_cents: number | null;
        created_at: string;
        status: string;
        user_id: string;
        base_id: string | null;
        pickup_code: string | null;
        delivery_code: string | null;
        picked_up_at: string | null;
        passenger_to_preparer_code: string | null;
        preparer_to_base_code: string | null;
        picked_up_by_preparer_at: string | null;
      };

      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', row.user_id)
        .maybeSingle();
      const p = prof as { full_name?: string | null } | null;

      const oLL = latLngFromDbColumns(row.origin_lat, row.origin_lng);
      const dLL = latLngFromDbColumns(row.destination_lat, row.destination_lng);
      const originCoord = oLL ?? { latitude: -23.5, longitude: -46.6 };
      const destinationCoord = dLL ?? originCoord;
      const deliveryHasMapCoords = Boolean(
        dLL && isValidGlobeCoordinate(dLL.latitude, dLL.longitude),
      );

      const { resolvedBaseId } = await resolveShipmentBaseIdForPreparerScreen({
        shipmentBaseId: row.base_id,
        originLat: oLL?.latitude ?? null,
        originLng: oLL?.longitude ?? null,
        workerBaseId: access.workerBaseId,
      });
      const effectiveBaseId = resolvedBaseId;
      const hasPreparerBase = Boolean(effectiveBaseId);

      const routeOpts = {
        mapboxToken: getMapboxAccessToken(),
        googleMapsApiKey: getGoogleMapsApiKey(),
      };

      if (!hasPreparerBase) {
        const pickupHasMapCoords = Boolean(
          oLL && isValidGlobeCoordinate(oLL.latitude, oLL.longitude),
        );
        const s: Shipment = {
          id: row.id,
          clientName: p?.full_name ?? 'Cliente',
          originAddress: row.origin_address ?? '',
          finalDestinationAddress: row.destination_address ?? '',
          baseAddress: row.destination_address ?? '',
          baseName: 'Destino',
          originCoord,
          baseCoord: destinationCoord,
          destinationCoord,
          pickupCoord: originCoord,
          deliveryCoord: destinationCoord,
          hasPreparerBase: false,
          pickupHasMapCoords,
          baseHasMapCoords: deliveryHasMapCoords,
          deliveryHasMapCoords,
        amountCents: row.amount_cents ?? 0,
        confirmedAt: row.created_at,
        pickupCodeExpected: String(row.pickup_code ?? ''),
        deliveryCodeExpected: String(row.delivery_code ?? ''),
        passengerToPreparerCode: String(row.passenger_to_preparer_code ?? ''),
        preparerToBaseCode: String(row.preparer_to_base_code ?? ''),
        pickedUpByPreparerAt: row.picked_up_by_preparer_at ?? null,
        coletaLetter: coletaLetterFromShipmentId(row.id),
      };
      setShipment(s);
      if (row.status === 'in_progress' || row.picked_up_at) setStep('to_delivery');

      const fullRoute = await getRouteWithDuration(s.pickupCoord, s.deliveryCoord, routeOpts);
      if (fullRoute) setFullRouteCoords(fullRoute.coordinates);
      else if (
        isValidGlobeCoordinate(s.pickupCoord.latitude, s.pickupCoord.longitude) &&
        isValidGlobeCoordinate(s.deliveryCoord.latitude, s.deliveryCoord.longitude)
      ) {
        setFullRouteCoords([s.pickupCoord, s.deliveryCoord]);
      }

      setLoading(false);
      return;
    }

      const { data: baseRow } = await supabase
        .from('bases')
        .select('id, name, address, city, state, lat, lng')
        .eq('id', effectiveBaseId)
        .eq('is_active', true)
        .maybeSingle();

      if (!baseRow) {
        setLoading(false);
        setLoadError('Base não encontrada ou inativa.');
        return;
      }

      const b = baseRow as {
        name: string;
        address: string;
        city: string;
        state: string | null;
        lat: number | null;
        lng: number | null;
      };

      const baseLL = latLngFromDbColumns(b.lat, b.lng);
      const baseHasMapCoords = Boolean(
        baseLL && isValidGlobeCoordinate(baseLL.latitude, baseLL.longitude),
      );
      const baseCoord = baseLL ?? originCoord;

      const pickupHasMapCoords = Boolean(
        oLL && isValidGlobeCoordinate(oLL.latitude, oLL.longitude),
      );
      const s: Shipment = {
        id: row.id,
        clientName: p?.full_name ?? 'Cliente',
        originAddress: row.origin_address ?? '',
        finalDestinationAddress: row.destination_address ?? '',
        baseAddress: [b.name, b.address, b.city].filter(Boolean).join(' — ') || b.address,
        baseName: b.name,
        originCoord,
        baseCoord,
        destinationCoord,
        pickupCoord: originCoord,
        deliveryCoord: baseCoord,
        hasPreparerBase: true,
        pickupHasMapCoords,
        baseHasMapCoords,
        /** Proximidade da 2ª etapa = depósito na base. */
        deliveryHasMapCoords: baseHasMapCoords,
        amountCents: row.amount_cents ?? 0,
        confirmedAt: row.created_at,
        pickupCodeExpected: String(row.pickup_code ?? ''),
        deliveryCodeExpected: String(row.delivery_code ?? ''),
        passengerToPreparerCode: String(row.passenger_to_preparer_code ?? ''),
        preparerToBaseCode: String(row.preparer_to_base_code ?? ''),
        pickedUpByPreparerAt: row.picked_up_by_preparer_at ?? null,
        coletaLetter: coletaLetterFromShipmentId(row.id),
      };
      setShipment(s);

      if (row.status === 'in_progress' || row.picked_up_at) setStep('to_delivery');

      const fullRoute = await getRouteWithDuration(s.pickupCoord, s.deliveryCoord, routeOpts);
      if (fullRoute) setFullRouteCoords(fullRoute.coordinates);
      else if (
        isValidGlobeCoordinate(s.pickupCoord.latitude, s.pickupCoord.longitude) &&
        isValidGlobeCoordinate(s.deliveryCoord.latitude, s.deliveryCoord.longitude)
      ) {
        setFullRouteCoords([s.pickupCoord, s.deliveryCoord]);
      }

      setLoading(false);
    })();
  }, [shipmentId]);

  // GPS tracking
  useEffect(() => {
    if (!Location) return;
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !mounted) return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy?.High ?? Location.Accuracy.Balanced,
      });
      if (mounted) {
        const la = pos.coords.latitude;
        const lo = pos.coords.longitude;
        setDriverPos({ latitude: la, longitude: lo });
        latestDriverFixRef.current = {
          latitude: la,
          longitude: lo,
          speedMps:
            typeof pos.coords.speed === 'number' && pos.coords.speed >= 0 ? pos.coords.speed : null,
          headingDeg:
            typeof pos.coords.heading === 'number' && pos.coords.heading >= 0 ? pos.coords.heading : null,
          timestamp: Date.now(),
        };
      }
      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy?.High ?? Location.Accuracy.Balanced,
          distanceInterval: 4,
          timeInterval: 1000,
        },
        (p: any) => {
          if (!mounted) return;
          const la = p.coords.latitude;
          const lo = p.coords.longitude;
          setDriverPos({ latitude: la, longitude: lo });
          latestDriverFixRef.current = {
            latitude: la,
            longitude: lo,
            speedMps: typeof p.coords.speed === 'number' && p.coords.speed >= 0 ? p.coords.speed : null,
            headingDeg: typeof p.coords.heading === 'number' && p.coords.heading >= 0 ? p.coords.heading : null,
            timestamp: Date.now(),
          };
          if (followNavRef.current) scheduleNavFrame();
        },
      );
    })();
    return () => {
      mounted = false;
      locationSubRef.current?.remove();
    };
  }, [scheduleNavFrame]);

  useEffect(() => {
    if (!followMyLocation || !Location?.watchHeadingAsync) return;
    let cancelled = false;
    let sub: { remove: () => void } | undefined;
    (async () => {
      try {
        const s = await Location.watchHeadingAsync((h: { trueHeading?: number; magHeading?: number }) => {
          const th = h.trueHeading;
          const mh = h.magHeading;
          const v =
            typeof th === 'number' && th >= 0 ? th : typeof mh === 'number' && mh >= 0 ? mh : null;
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

  // Driver → current stop route
  useEffect(() => {
    if (!driverPos || !shipment) return;
    const target = step === 'to_pickup' ? shipment.pickupCoord : shipment.deliveryCoord;
    getRouteWithDuration(driverPos, target, { mapboxToken: getMapboxAccessToken(), googleMapsApiKey: getGoogleMapsApiKey() }).then((r) => {
      if (r) {
        setDriverRouteCoords(r.coordinates);
        setEtaSeconds(r.durationSeconds);
      } else {
        setDriverRouteCoords([driverPos, target]);
        const km = haversineKm(driverPos, target);
        setEtaSeconds(Math.round((km / 30) * 3600));
      }
    });
  }, [driverPos, step, shipment]);

  useEffect(() => {
    if (driverRouteCoords.length >= 2) routeForSnapRef.current = driverRouteCoords;
    else if (fullRouteCoords.length >= 2) routeForSnapRef.current = fullRouteCoords;
    else routeForSnapRef.current = [];
  }, [driverRouteCoords, fullRouteCoords]);

  const navRoutePresentation = useMemo(() => {
    const goldBase = fullRouteCoords;
    const darkBase = driverRouteCoords;
    const guide =
      darkBase.length >= 2 ? darkBase : goldBase.length >= 2 ? goldBase : [];

    if (
      !followMyLocation ||
      !driverPos ||
      !isValidGlobeCoordinate(driverPos.latitude, driverPos.longitude)
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
    const snap = snapToRoutePolyline(driverPos, guide, NAV_ROUTE_SNAP_MAX_M);
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
      trimmed = [snap.snapped, guide[guide.length - 1]!];
    }
    if (darkBase.length >= 2) {
      return {
        goldLine: [],
        darkLine: trimmed.length >= 2 ? trimmed : darkBase,
        showGold: false,
        showDark: trimmed.length >= 2,
        snappedForFallback: snap.snapped,
      };
    }
    return {
      goldLine: trimmed.length >= 2 ? trimmed : goldBase,
      darkLine: [],
      showGold: trimmed.length >= 2,
      showDark: false,
      snappedForFallback: snap.snapped,
    };
  }, [followMyLocation, driverPos, fullRouteCoords, driverRouteCoords]);

  /** Ao chegar perto da coleta ou do destino de entrega, abre o modal de código (uma vez por etapa). */
  useEffect(() => {
    if (!driverPos || !shipment || loading) return;
    if (step === 'to_pickup' && !pickupVisible && !autoModalRef.current.pickup) {
      if (
        shipment.pickupHasMapCoords &&
        haversineKm(driverPos, shipment.pickupCoord) <= NEARBY_KM
      ) {
        autoModalRef.current.pickup = true;
        setPickupVisible(true);
      }
    }
    if (step === 'to_delivery' && !deliveryVisible && !autoModalRef.current.delivery) {
      if (
        shipment.deliveryHasMapCoords &&
        haversineKm(driverPos, shipment.deliveryCoord) <= NEARBY_KM
      ) {
        autoModalRef.current.delivery = true;
        setDeliveryVisible(true);
      }
    }
  }, [driverPos, shipment, step, loading, pickupVisible, deliveryVisible]);

  const focusColeta = useCallback(() => {
    if (!shipment) return;
    setFollowMyLocation(false);
    mapRef.current?.animateToRegion(
      {
        latitude: shipment.pickupCoord.latitude,
        longitude: shipment.pickupCoord.longitude,
        latitudeDelta: 0.045,
        longitudeDelta: 0.045,
      },
      400,
    );
  }, [shipment]);

  const focusEntrega = useCallback(() => {
    if (!shipment) return;
    setFollowMyLocation(false);
    mapRef.current?.animateToRegion(
      {
        latitude: shipment.deliveryCoord.latitude,
        longitude: shipment.deliveryCoord.longitude,
        latitudeDelta: 0.045,
        longitudeDelta: 0.045,
      },
      400,
    );
  }, [shipment]);

  // PDF cenário 3 (com base): o preparador NÃO digita o PIN A — ele apenas
  // INFORMA verbalmente ao passageiro, que valida no app cliente. O passageiro
  // valida → backend seta `picked_up_by_preparer_at`. Aqui só verificamos se já
  // foi validado e avançamos.
  // PDF cenário 4 (sem base): comportamento legado — preparador digita
  // `pickup_code` para registrar a coleta.
  const confirmPickup = async () => {
    if (!shipment) return;

    if (shipment.hasPreparerBase) {
      setPickupLoading(true);
      try {
        const { data, error } = await supabase
          .from('shipments')
          .select('picked_up_by_preparer_at, status, picked_up_at')
          .eq('id', shipment.id)
          .maybeSingle();
        if (error || !data) {
          showAlert('Erro', 'Não foi possível verificar a coleta. Tente novamente.');
          return;
        }
        const row = data as {
          picked_up_by_preparer_at: string | null;
          status: string;
          picked_up_at: string | null;
        };
        if (!row.picked_up_by_preparer_at) {
          showAlert(
            'Aguardando o cliente',
            'O cliente ainda não validou o código no app dele. Confirme com ele que digitou o código que você informou.',
          );
          return;
        }
        const { error: upErr } = await supabase
          .from('shipments')
          .update({
            status: 'in_progress',
            pickup_notes: pickupObs.trim() || null,
            picked_up_at: row.picked_up_at ?? new Date().toISOString(),
          } as never)
          .eq('id', shipment.id);
        if (upErr) {
          showAlert('Não foi possível confirmar', upErr.message || 'Tente novamente.');
          return;
        }
        setShipment((s) => (s ? { ...s, pickedUpByPreparerAt: row.picked_up_by_preparer_at } : s));
        autoModalRef.current = { pickup: false, delivery: false };
        setStep('to_delivery');
        setPickupVisible(false);
        setPickupObs('');
        mapRef.current?.animateToRegion(
          { ...shipment.deliveryCoord, latitudeDelta: 0.02, longitudeDelta: 0.02 },
          600,
        );
      } finally {
        setPickupLoading(false);
      }
      return;
    }

    if (!pickupCode.trim()) return;
    const expDigits = onlyDigits(shipment.pickupCodeExpected);
    if (expDigits.length !== 4) {
      showAlert(
        'Código indisponível',
        'Não foi possível carregar o código desta coleta. Atualize a tela ou entre em contato com o suporte.',
      );
      return;
    }
    if (!shipmentCodesMatch(shipment.pickupCodeExpected, pickupCode)) {
      showAlert('Código incorreto', 'Confira o código de confirmação da coleta com o cliente.');
      return;
    }
    setPickupLoading(true);
    try {
      const { error: upErr } = await supabase
        .from('shipments')
        .update({
          status: 'in_progress',
          pickup_notes: pickupObs.trim() || null,
          picked_up_at: new Date().toISOString(),
        } as never)
        .eq('id', shipment.id);
      if (upErr) {
        showAlert('Não foi possível confirmar', upErr.message || 'Tente novamente.');
        return;
      }
      autoModalRef.current = { pickup: false, delivery: false };
      setStep('to_delivery');
      setPickupVisible(false);
      setPickupCode('');
      setPickupObs('');
      mapRef.current?.animateToRegion(
        { ...shipment.deliveryCoord, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        600,
      );
    } finally {
      setPickupLoading(false);
    }
  };

  const finalizeBaseDeliverySuccess = useCallback(async () => {
    const cur = shipment;
    if (!cur) return;
    if (deliveryObs.trim()) {
      await supabase
        .from('shipments')
        .update({ delivery_notes: deliveryObs.trim() } as never)
        .eq('id', cur.id);
    }
    await closeShipmentConversation(cur.id);
    setDeliveryVisible(false);
    setDeliveryCode('');
    setDeliveryObs('');
    setDeliveryPinManual(false);
    setSummaryVisible(true);
  }, [shipment, deliveryObs]);

  const refreshDeliveryAtBase = useCallback(async () => {
    if (!shipment?.hasPreparerBase) return;
    setDeliveryLoading(true);
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('delivered_to_base_at')
        .eq('id', shipment.id)
        .maybeSingle();
      if (error || !data) {
        showAlert('Erro', 'Não foi possível verificar o depósito. Tente novamente.');
        return;
      }
      const row = data as { delivered_to_base_at: string | null };
      if (row.delivered_to_base_at) {
        await finalizeBaseDeliverySuccess();
      } else {
        showAlert(
          'A aguardar',
          'O operador ainda não confirmou no painel admin. Peça para validar o PIN B.',
        );
      }
    } finally {
      setDeliveryLoading(false);
    }
  }, [shipment, finalizeBaseDeliverySuccess]);

  useEffect(() => {
    if (!deliveryVisible || !shipment?.hasPreparerBase || deliveryPinManual) return;
    const id = shipment.id;
    const channel = supabase
      .channel(`preparer-base-delivery-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shipments',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const next = (payload.new ?? {}) as { delivered_to_base_at?: string | null };
          if (next.delivered_to_base_at) {
            void finalizeBaseDeliverySuccess();
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [deliveryVisible, shipment?.id, shipment?.hasPreparerBase, deliveryPinManual, finalizeBaseDeliverySuccess]);

  useEffect(() => {
    if (!deliveryVisible) setDeliveryPinManual(false);
  }, [deliveryVisible]);

  // PDF cenário 3 (com base): PIN B — o preparador informa verbalmente ao admin;
  // o admin valida no painel. Fallback: preparador digita (RPC `complete_shipment_preparer_to_base`).
  // PDF cenário 4 (sem base): preparador digita `delivery_code` para concluir entrega ao destinatário.
  const confirmDelivery = async () => {
    if (!shipment) return;

    if (shipment.hasPreparerBase && !deliveryPinManual) {
      await refreshDeliveryAtBase();
      return;
    }

    if (!deliveryCode.trim()) return;

    if (shipment.hasPreparerBase) {
      setDeliveryLoading(true);
      try {
        const { data, error } = await supabase.rpc(
          'complete_shipment_preparer_to_base' as never,
          { p_shipment_id: shipment.id, p_confirmation_code: deliveryCode } as never,
        );
        if (error) {
          showAlert('Erro', getUserErrorMessage(error));
          return;
        }
        const payload = data as { ok?: boolean; error?: string } | null;
        if (!payload || payload.ok !== true) {
          const err = String(payload?.error ?? '');
          if (err === 'invalid_code' || err === 'code_length' || err === 'missing_code') {
            showAlert('Código incorreto', 'Confira o código informado pela base.');
          } else if (err === 'pickup_not_completed') {
            showAlert(
              'Coleta pendente',
              'A coleta com o cliente ainda não foi confirmada. Confirme antes de entregar na base.',
            );
          } else if (err === 'forbidden') {
            showAlert('Acesso negado', 'Esta encomenda não está sob sua responsabilidade.');
          } else if (err === 'no_base') {
            showAlert('Sem base', 'Esta encomenda não está vinculada a uma base.');
          } else {
            showAlert('Erro', 'Não foi possível confirmar. Tente novamente.');
          }
          return;
        }
        await finalizeBaseDeliverySuccess();
      } finally {
        setDeliveryLoading(false);
      }
      return;
    }

    const expDigits = onlyDigits(shipment.deliveryCodeExpected);
    if (expDigits.length !== 4) {
      showAlert(
        'Código indisponível',
        'Não foi possível carregar o código desta entrega. Atualize a tela ou entre em contato com o suporte.',
      );
      return;
    }
    if (!shipmentCodesMatch(shipment.deliveryCodeExpected, deliveryCode)) {
      showAlert('Código incorreto', 'Confira o código de confirmação da entrega.');
      return;
    }
    setDeliveryLoading(true);
    try {
      const { error: upErr } = await supabase
        .from('shipments')
        .update({
          status: 'delivered',
          delivery_notes: deliveryObs.trim() || null,
          delivered_at: new Date().toISOString(),
        } as never)
        .eq('id', shipment.id);
      if (upErr) {
        showAlert('Não foi possível registrar', upErr.message || 'Tente novamente.');
        return;
      }
      await closeShipmentConversation(shipment.id);
      setDeliveryVisible(false);
      setDeliveryCode('');
      setDeliveryObs('');
      setSummaryVisible(true);
    } finally {
      setDeliveryLoading(false);
    }
  };

  const submitRating = async () => {
    if (!shipment) return;
    if (rating < 1) {
      showAlert('Avaliação', 'Selecione de 1 a 5 estrelas para enviar.');
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      showAlert('Erro', 'Sessão inválida. Faça login novamente.');
      return;
    }
    setSummaryLoading(true);
    try {
      const { error } = await supabase.from('shipment_driver_ratings' as never).upsert(
        {
          shipment_id: shipment.id,
          driver_id: user.id,
          rating,
          comment: ratingComment.trim() || null,
        } as never,
        { onConflict: 'shipment_id' }
      );
      if (error) throw error;
      setSummaryVisible(false);
      navigation.navigate('ColetasMain');
    } catch (e: unknown) {
      if (isShipmentDriverRatingsUnavailableError(e)) {
        showAlert(
          'Avaliação indisponível',
          'O servidor Supabase ainda não tem a tabela shipment_driver_ratings. Aplique as migrações do repositório (por exemplo supabase db push ou SQL no painel).',
        );
      } else {
        showAlert('Erro', getUserErrorMessage(e));
      }
    } finally {
      setSummaryLoading(false);
    }
  };

  if (loadError) {
    return (
      <View style={styles.loadingCenter}>
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity style={styles.errorBackBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Text style={styles.errorBackBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading || !shipment) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color={DARK} />
      </View>
    );
  }

  const currentAddress =
    step === 'to_pickup'
      ? shipment.originAddress
      : shipment.hasPreparerBase
        ? shipment.baseAddress
        : shipment.finalDestinationAddress;
  const elapsedSec = Math.round((Date.now() - startTimeRef.current) / 1000);
  const totalKm = routeDistanceKm(
    fullRouteCoords.length > 1 ? fullRouteCoords : [shipment.pickupCoord, shipment.deliveryCoord],
  );

  const pickupDone = step === 'to_delivery';
  const overlayTop = insets.top + 56;
  const fallbackNavTarget = step === 'to_pickup' ? shipment.pickupCoord : shipment.deliveryCoord;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Mapa em tela cheia — mesmo padrão do ActiveTrip (motorista) */}
      <GoogleMapsMap
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={mapInitialRegion}
        onUserAdjustedMap={() => {
          setFollowMyLocation(false);
          const fix = latestDriverFixRef.current;
          if (fix && mapRef.current && isValidGlobeCoordinate(fix.latitude, fix.longitude)) {
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
        {navRoutePresentation.showDark && navRoutePresentation.darkLine.length >= 2 && (
          <MapPolyline id="driver" coordinates={navRoutePresentation.darkLine} strokeColor={DARK} strokeWidth={3} />
        )}
        {navRoutePresentation.showGold && navRoutePresentation.goldLine.length >= 2 && (
          <MapPolyline id="full" coordinates={navRoutePresentation.goldLine} strokeColor={GOLD} strokeWidth={5} />
        )}
        {fullRouteCoords.length < 2 &&
          driverRouteCoords.length < 2 &&
          driverPos &&
          isValidGlobeCoordinate(driverPos.latitude, driverPos.longitude) &&
          isValidGlobeCoordinate(fallbackNavTarget.latitude, fallbackNavTarget.longitude) && (
            <MapPolyline
              id="fallback"
              coordinates={[navRoutePresentation.snappedForFallback ?? driverPos, fallbackNavTarget]}
              strokeColor={GOLD}
              strokeWidth={4}
            />
          )}

        <MapMarker id="stop-pickup" coordinate={shipment.pickupCoord} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.mapStopMarker, pickupDone ? styles.mapStopMarkerDone : { backgroundColor: GOLD }]}>
            <MaterialIcons
              name={pickupDone ? 'check' : 'inventory-2'}
              size={18}
              color="#fff"
            />
          </View>
        </MapMarker>
        <MapMarker id="stop-delivery" coordinate={shipment.deliveryCoord} anchor={{ x: 0.5, y: 0.5 }}>
          <View
            style={[
              styles.mapStopMarker,
              pickupDone ? { backgroundColor: GOLD } : styles.mapStopMarkerPending,
            ]}
          >
            <MaterialIcons
              name={pickupDone ? 'place' : shipment.hasPreparerBase ? 'store' : 'place'}
              size={18}
              color={pickupDone ? '#fff' : '#6B7280'}
            />
          </View>
        </MapMarker>

        {driverPos && !followMyLocation && isValidGlobeCoordinate(driverPos.latitude, driverPos.longitude) && (
          <SmoothDriverMapMarker
            id="driver-pos"
            targetLatitude={driverPos.latitude}
            targetLongitude={driverPos.longitude}
            following={false}
          />
        )}
      </GoogleMapsMap>

      {followMyLocation &&
        driverPos &&
        isValidGlobeCoordinate(driverPos.latitude, driverPos.longitude) && (
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

      {/* Overlay alinhado ao ActiveTrip: safe area + controles */}
      <SafeAreaView edges={['top', 'bottom']} style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 8, left: 14 }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <MaterialIcons name="arrow-back" size={20} color={DARK} />
        </TouchableOpacity>

        {!isOnline && (
          <View
            style={[styles.networkBadgeWrap, { top: insets.top + 12 }]}
            pointerEvents="none"
          >
            <MapNetworkBadge online={false} />
          </View>
        )}

        <View style={[styles.zoomWrap, { top: overlayTop, left: 14 }]} pointerEvents="box-none">
          <MapZoomControls
            mapRef={mapRef}
            floating={false}
            onBeforeZoom={() => {
              setFollowMyLocation(false);
              const fix = latestDriverFixRef.current;
              if (fix && mapRef.current && isValidGlobeCoordinate(fix.latitude, fix.longitude)) {
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

        <DriverLocationFocusButton
          following={followMyLocation}
          style={[
            styles.myLocationBtn,
            { top: overlayTop + 44 + 6 + 44 + 10, left: 14 },
          ]}
          onPress={() => {
            if (!driverPos || !isValidGlobeCoordinate(driverPos.latitude, driverPos.longitude)) return;
            setFollowMyLocation(true);
          }}
        />

        {/* Barra direita: encomenda — coleta → entrega (tocar centraliza no ponto) */}
        <View style={[styles.sidebar, { top: overlayTop, right: 14 }]} pointerEvents="box-none">
          <View style={styles.sidebarLine} pointerEvents="none" />
          <TouchableOpacity
            style={[
              styles.sidebarBtn,
              pickupDone ? { backgroundColor: '#9CA3AF' } : { backgroundColor: GOLD },
            ]}
            onPress={focusColeta}
            activeOpacity={0.85}
          >
            <MaterialIcons name={pickupDone ? 'check' : 'inventory-2'} size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sidebarBtn,
              pickupDone ? styles.sidebarDestBtn : { backgroundColor: '#E5E7EB' },
            ]}
            onPress={focusEntrega}
            activeOpacity={0.85}
          >
            <MaterialIcons name="place" size={18} color={pickupDone ? DARK : '#6B7280'} />
          </TouchableOpacity>
        </View>

        {/* Cartão flutuante — mesmo estilo do miniSheet da viagem ativa */}
        <View
          style={[
            styles.miniSheet,
            { bottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 12) + 16 : 20 },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.miniSheetTopRow}>
            <View style={styles.stopTypePill}>
              <View style={styles.stopTypeDot} />
              <Text style={styles.stopTypePillText}>Encomenda</Text>
            </View>
            {etaSeconds > 0 && (
              <View style={styles.etaBadge}>
                <Text style={styles.etaBadgeText}>{Math.max(1, Math.round(etaSeconds / 60))} min</Text>
              </View>
            )}
          </View>

          <Text style={styles.miniSheetName} numberOfLines={1}>
            {step === 'to_pickup'
              ? `Coleta — ${shipment.clientName}`
              : shipment.hasPreparerBase
                ? `Depósito na base — ${shipment.baseName}`
                : 'Entrega ao destino'}
          </Text>
          <View style={styles.miniAddressRow}>
            <MaterialIcons name="location-on" size={14} color="#6B7280" />
            <Text style={styles.miniAddressText} numberOfLines={2}>
              {currentAddress}
            </Text>
          </View>
          <View style={styles.miniSheetFooter}>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${step === 'to_pickup' ? 50 : 100}%` as any },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{step === 'to_pickup' ? '1' : '2'}/2</Text>
          </View>
          <TouchableOpacity
            style={styles.miniConfirmBtn}
            activeOpacity={0.85}
            onPress={() => (step === 'to_pickup' ? setPickupVisible(true) : setDeliveryVisible(true))}
          >
            <Text style={styles.miniConfirmBtnText}>
              {step === 'to_pickup'
                ? 'Confirmar coleta'
                : shipment.hasPreparerBase
                  ? 'Confirmar na base'
                  : 'Confirmar entrega'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Pickup modal ── */}
      <Modal
        visible={pickupVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !pickupLoading && setPickupVisible(false)}
      >
        <KeyboardAvoidingView behavior="padding" style={styles.kbav}>
          <View style={styles.modalOverlay}>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Deseja confirmar a Coleta {shipment.coletaLetter}?</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setPickupVisible(false)} activeOpacity={0.7}>
                  <MaterialIcons name="close" size={18} color="#374151" />
                </TouchableOpacity>
              </View>
              <View style={styles.divider} />
              <ScrollView keyboardShouldPersistTaps="handled">
                {shipment.hasPreparerBase ? (
                  <>
                    <Text style={styles.fieldLabel}>
                      Informe este código ao cliente
                    </Text>
                    <Text style={styles.handoffHint}>
                      Diga estes 4 dígitos ao cliente. Ele vai digitar no app dele
                      para validar a coleta. Quando ele confirmar, toque no botão
                      abaixo para seguir até a base.
                    </Text>
                    <View style={styles.handoffPinBox}>
                      <Text style={styles.handoffPinText}>
                        {shipment.passengerToPreparerCode || '— — — —'}
                      </Text>
                    </View>
                    <View style={styles.obsRow}>
                      <Text style={styles.fieldLabel}>Observações</Text>
                      <Text style={styles.optional}>Opcional</Text>
                    </View>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder={'Descreva algo importante sobre esta\ncoleta (ex: pacote danificado, cliente\nausente...)'}
                      placeholderTextColor="#9CA3AF"
                      value={pickupObs}
                      onChangeText={setPickupObs}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={confirmPickup}
                      disabled={pickupLoading}
                      activeOpacity={0.85}
                    >
                      {pickupLoading
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <Text style={styles.primaryBtnText}>Cliente confirmou — seguir para a base</Text>
                      }
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.fieldLabel}>Código de confirmação</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: 482915"
                      placeholderTextColor="#9CA3AF"
                      value={pickupCode}
                      onChangeText={setPickupCode}
                      autoCapitalize="characters"
                    />
                    <View style={styles.obsRow}>
                      <Text style={styles.fieldLabel}>Observações</Text>
                      <Text style={styles.optional}>Opcional</Text>
                    </View>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder={'Descreva algo importante sobre esta\ncoleta (ex: pacote danificado, cliente\nausente...)'}
                      placeholderTextColor="#9CA3AF"
                      value={pickupObs}
                      onChangeText={setPickupObs}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                    <TouchableOpacity
                      style={[styles.primaryBtn, !pickupCode.trim() && styles.btnDisabled]}
                      onPress={confirmPickup}
                      disabled={!pickupCode.trim() || pickupLoading}
                      activeOpacity={0.85}
                    >
                      {pickupLoading
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <Text style={styles.primaryBtnText}>Sim, confirmar</Text>
                      }
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setPickupVisible(false)} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>Não, voltar</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Delivery modal ── */}
      <Modal
        visible={deliveryVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !deliveryLoading && setDeliveryVisible(false)}
      >
        <KeyboardAvoidingView behavior="padding" style={styles.kbav}>
          <View style={styles.modalOverlay}>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>
                    {shipment.hasPreparerBase ? 'Confirmar depósito na base' : 'Confirmar entrega'}
                  </Text>
                  <Text style={styles.sheetSub}>
                    {shipment.hasPreparerBase
                      ? deliveryPinManual
                        ? 'Solicite o código à base e digite abaixo (fallback).\nA entrega ao destinatário é feita pelo motorista.'
                        : 'O seu PIN está abaixo — informe-o ao operador da base. Quando o admin validar no painel, o depósito fecha automaticamente ou toque em «Atualizar estado».\nA entrega ao destinatário é feita pelo motorista.'
                      : `Insira o código de confirmação da entrega\npara registrar a conclusão.`}
                  </Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setDeliveryVisible(false)} activeOpacity={0.7}>
                  <MaterialIcons name="close" size={18} color="#374151" />
                </TouchableOpacity>
              </View>
              <View style={styles.divider} />
              <ScrollView keyboardShouldPersistTaps="handled">
                {shipment.hasPreparerBase && !deliveryPinManual ? (
                  <>
                    <Text style={styles.fieldLabel}>O seu PIN (informar à base)</Text>
                    <View style={styles.pinChipsWrap}>
                      {pinCharsForDisplay(shipment.preparerToBaseCode).map((ch, i) => (
                        <View key={`pbtb-${i}`} style={styles.pinChip}>
                          <Text style={styles.pinChipText}>{ch}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.pinRowActions}>
                      <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={() => {
                          const t = String(shipment.preparerToBaseCode ?? '').trim();
                          if (t) Clipboard.setString(t);
                        }}
                        accessibilityLabel="Copiar PIN"
                      >
                        <MaterialIcons name="content-copy" size={20} color="#374151" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={() => {
                          void (async () => {
                            const t = String(shipment.preparerToBaseCode ?? '').trim();
                            if (!t) return;
                            try {
                              await Share.share({ message: `PIN de depósito na base TakeMe: ${t}` });
                            } catch {
                              /* ignore */
                            }
                          })();
                        }}
                        accessibilityLabel="Partilhar PIN"
                      >
                        <MaterialIcons name="share" size={20} color="#374151" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.basePickupLinkBtn}
                      onPress={() => {
                        setDeliveryPinManual(true);
                        setDeliveryCode('');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.basePickupLinkText}>Base fora do ar — digitar PIN manualmente</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.fieldLabel}>
                      {shipment.hasPreparerBase
                        ? 'Código informado pela base'
                        : 'Código de entrega'}
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder={shipment.hasPreparerBase ? 'Ex: 1234' : 'Ex: BASE132'}
                      placeholderTextColor="#9CA3AF"
                      value={deliveryCode}
                      onChangeText={setDeliveryCode}
                      autoCapitalize="characters"
                      keyboardType={shipment.hasPreparerBase ? 'number-pad' : 'default'}
                      maxLength={shipment.hasPreparerBase ? 4 : undefined}
                    />
                  </>
                )}
                <View style={styles.obsRow}>
                  <Text style={styles.fieldLabel}>Observações</Text>
                  <Text style={styles.optional}>Opcional</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder={'Observações sobre o item (ex: embalagem\naberta, atraso...)'}
                  placeholderTextColor="#9CA3AF"
                  value={deliveryObs}
                  onChangeText={setDeliveryObs}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    !(shipment.hasPreparerBase && !deliveryPinManual) && !deliveryCode.trim() && styles.btnDisabled,
                  ]}
                  onPress={confirmDelivery}
                  disabled={
                    deliveryLoading
                    || (!(shipment.hasPreparerBase && !deliveryPinManual) && !deliveryCode.trim())
                  }
                  activeOpacity={0.85}
                >
                  {deliveryLoading
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : (
                      <Text style={styles.primaryBtnText}>
                        {shipment.hasPreparerBase && !deliveryPinManual
                          ? 'Atualizar estado'
                          : shipment.hasPreparerBase
                            ? 'Confirmar depósito'
                            : 'Confirmar entrega'}
                      </Text>
                    )
                  }
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeliveryVisible(false)} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>Voltar</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Summary modal ── */}
      <Modal
        visible={summaryVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !summaryLoading && setSummaryVisible(false)}
      >
        <KeyboardAvoidingView behavior="padding" style={styles.kbav}>
          <View style={styles.modalOverlay}>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>
                    {shipment.hasPreparerBase ? 'Depósito na base concluído!' : 'Entrega concluída!'}
                  </Text>
                  <Text style={styles.sheetSub}>
                    {shipment.hasPreparerBase
                      ? 'Sua parte na coleta foi registrada. O motorista segue com a entrega ao destino final.'
                      : `Todas as entregas do dia foram\nregistradas com sucesso.`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => { setSummaryVisible(false); navigation.navigate('ColetasMain'); }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="close" size={18} color="#374151" />
                </TouchableOpacity>
              </View>
              <View style={styles.divider} />
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Tempo total</Text>
                  <Text style={styles.statValue}>{formatEta(Math.max(60, elapsedSec))}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Distância percorrida</Text>
                  <Text style={styles.statValue}>{totalKm.toFixed(1)} km</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={[styles.statRow, { marginBottom: 20 }]}>
                  <Text style={[styles.statLabel, { fontWeight: '700', color: DARK }]}>Total recebido</Text>
                  <Text style={styles.totalValue}>
                    {(shipment.amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </Text>
                </View>

                <Text style={styles.ratingQ}>Como foi a viagem?</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.8}>
                      <View style={[styles.starCircle, star <= rating && styles.starCircleActive]}>
                        <MaterialIcons
                          name={star <= rating ? 'star' : 'star-border'}
                          size={26}
                          color={star <= rating ? GOLD : '#D1D5DB'}
                        />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.ratingHint}>(1 = muito insatisfeito, 5 = muito satisfeito)</Text>

                <View style={styles.obsRow}>
                  <Text style={styles.fieldLabel}>Comentário</Text>
                  <Text style={styles.optional}>Opcional</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Descreva algum comentário sobre a entrega..."
                  placeholderTextColor="#9CA3AF"
                  value={ratingComment}
                  onChangeText={setRatingComment}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <TouchableOpacity style={styles.primaryBtn} onPress={submitRating} disabled={summaryLoading} activeOpacity={0.85}>
                  {summaryLoading
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <Text style={styles.primaryBtnText}>Enviar avaliação</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.makeMoreBtn}
                  onPress={() => { setSummaryVisible(false); navigation.navigate('ColetasMain'); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.makeMoreText}>Fazer mais coletas</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 24 },
  errorText: { fontSize: 15, color: DARK, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  errorBackBtn: { backgroundColor: DARK, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  errorBackBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  zoomWrap: { position: 'absolute' },

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

  myLocationBtn: {
    position: 'absolute',
  },

  networkBadgeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },

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

  mapStopMarker: {
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
  mapStopMarkerDone: { backgroundColor: '#374151' },
  mapStopMarkerPending: { backgroundColor: '#E5E7EB', borderColor: '#E5E7EB' },

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

  miniSheet: {
    position: 'absolute',
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
  miniAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 0,
  },
  miniAddressText: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
    lineHeight: 18,
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
  miniConfirmBtn: {
    backgroundColor: DARK,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  miniConfirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Modals
  kbav: { flex: 1 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12, maxHeight: '88%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginBottom: 20,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: DARK, marginBottom: 4 },
  sheetSub: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: DARK, marginBottom: 8 },
  optional: { fontSize: 13, color: '#9CA3AF' },
  obsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8, marginTop: 16,
  },
  input: {
    backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: DARK, marginBottom: 8,
  },
  textArea: { height: 110, paddingTop: 14 },
  primaryBtn: {
    backgroundColor: DARK, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 16, marginBottom: 8,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  btnDisabled: { opacity: 0.5 },
  cancelBtn: { paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
  // Cenário 3 (handoff Passageiro → Preparador): destaque do PIN A.
  handoffHint: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  handoffPinBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 8,
  },
  handoffPinText: {
    fontSize: 32,
    fontWeight: '700',
    color: DARK,
    letterSpacing: 6,
  },

  // Summary
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  statLabel: { fontSize: 15, color: '#6B7280' },
  statValue: { fontSize: 15, fontWeight: '600', color: DARK },
  statDivider: { height: 1, backgroundColor: '#F3F4F6' },
  totalValue: { fontSize: 22, fontWeight: '700', color: DARK },
  ratingQ: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  starCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center',
  },
  starCircleActive: { backgroundColor: '#FEF3C7' },
  ratingHint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 20 },
  makeMoreBtn: { paddingVertical: 14, alignItems: 'center' },
  makeMoreText: { fontSize: 15, fontWeight: '500', color: DARK },
});
