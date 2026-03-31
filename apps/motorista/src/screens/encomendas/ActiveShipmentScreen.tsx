import { useState, useEffect, useRef, useMemo } from 'react';
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
} from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ColetasEncomendasStackParamList } from '../../navigation/ColetasEncomendasStack';
import { supabase } from '../../lib/supabase';
import {
  GoogleMapsMap,
  MapMarker,
  MapPolyline,
  latLngFromDbColumns,
  regionFromLatLngPoints,
  type GoogleMapsMapRef,
} from '../../components/googleMaps';
import { getGoogleMapsApiKey, getMapboxAccessToken } from '../../lib/googleMapsConfig';
import { getRouteWithDuration, formatEta } from '../../lib/route';

let Location: any = null;
try { Location = require('expo-location'); } catch { /* not linked yet */ }

const GOLD = '#C9A227';
const DARK = '#111827';

type Props = NativeStackScreenProps<ColetasEncomendasStackParamList, 'ActiveShipment'>;
type Coord = { latitude: number; longitude: number };
type Step = 'to_pickup' | 'to_delivery';

type Shipment = {
  id: string;
  clientName: string;
  originAddress: string;
  destinationAddress: string;
  originCoord: Coord;
  destCoord: Coord;
  amountCents: number;
  confirmedAt: string;
};

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

export function ActiveShipmentScreen({ navigation, route }: Props) {
  const { shipmentId } = route.params;
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('to_pickup');
  const [driverPos, setDriverPos] = useState<Coord | null>(null);
  const [fullRouteCoords, setFullRouteCoords] = useState<Coord[]>([]);
  const [driverRouteCoords, setDriverRouteCoords] = useState<Coord[]>([]);
  const [etaSeconds, setEtaSeconds] = useState(0);

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

  // Summary modal
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  const mapRef = useRef<GoogleMapsMapRef>(null);
  const locationSubRef = useRef<any>(null);
  const startTimeRef = useRef(Date.now());

  const mapInitialRegion = useMemo(() => {
    if (!shipment) return regionFromLatLngPoints([]);
    const pts: Coord[] = [];
    if (driverPos) pts.push(driverPos);
    pts.push(shipment.originCoord, shipment.destCoord);
    return regionFromLatLngPoints(pts);
  }, [shipment, driverPos]);

  // Load shipment
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('shipments')
        .select(
          'id, origin_address, destination_address, origin_lat, origin_lng, destination_lat, destination_lng, amount_cents, created_at, status, user_id',
        )
        .eq('id', shipmentId)
        .maybeSingle();

      if (!data) { setLoading(false); return; }
      const row = data as any;

      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', row.user_id)
        .maybeSingle();
      const p = prof as { full_name?: string | null } | null;

      const oLL = latLngFromDbColumns(row.origin_lat, row.origin_lng);
      const dLL = latLngFromDbColumns(row.destination_lat, row.destination_lng);
      const s: Shipment = {
        id: row.id,
        clientName: p?.full_name ?? 'Cliente',
        originAddress: row.origin_address ?? '',
        destinationAddress: row.destination_address ?? '',
        originCoord: oLL ?? { latitude: -23.5, longitude: -46.6 },
        destCoord: dLL ?? { latitude: -23.51, longitude: -46.61 },
        amountCents: row.amount_cents ?? 0,
        confirmedAt: row.created_at,
      };
      setShipment(s);

      if (row.status === 'picked_up') setStep('to_delivery');

      const routeOpts = { mapboxToken: getMapboxAccessToken(), googleMapsApiKey: getGoogleMapsApiKey() };
      const fullRoute = await getRouteWithDuration(s.originCoord, s.destCoord, routeOpts);
      if (fullRoute) setFullRouteCoords(fullRoute.coordinates);

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
      const pos = await Location.getCurrentPositionAsync({});
      if (mounted) setDriverPos({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      locationSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy?.High ?? 5, distanceInterval: 15 },
        (p: any) => {
          if (mounted) setDriverPos({ latitude: p.coords.latitude, longitude: p.coords.longitude });
        },
      );
    })();
    return () => {
      mounted = false;
      locationSubRef.current?.remove();
    };
  }, []);

  // Driver → current stop route
  useEffect(() => {
    if (!driverPos || !shipment) return;
    const target = step === 'to_pickup' ? shipment.originCoord : shipment.destCoord;
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

  const confirmPickup = async () => {
    if (!pickupCode.trim() || !shipment) return;
    setPickupLoading(true);
    try {
      await supabase
        .from('shipments')
        .update({
          status: 'picked_up',
          pickup_code: pickupCode.trim(),
          pickup_notes: pickupObs.trim() || null,
          pickup_confirmed_at: new Date().toISOString(),
        } as never)
        .eq('id', shipment.id);
      setStep('to_delivery');
      setPickupVisible(false);
      setPickupCode('');
      setPickupObs('');
      mapRef.current?.animateToRegion(
        { ...shipment.destCoord, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        600,
      );
    } finally {
      setPickupLoading(false);
    }
  };

  const confirmDelivery = async () => {
    if (!deliveryCode.trim() || !shipment) return;
    setDeliveryLoading(true);
    try {
      await supabase
        .from('shipments')
        .update({
          status: 'delivered',
          delivery_code: deliveryCode.trim(),
          delivery_notes: deliveryObs.trim() || null,
          delivered_at: new Date().toISOString(),
        } as never)
        .eq('id', shipment.id);
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
    setSummaryLoading(true);
    try {
      if (rating > 0 || ratingComment.trim()) {
        await supabase.from('shipment_ratings').insert({
          shipment_id: shipment.id,
          rating,
          comment: ratingComment.trim() || null,
        } as never);
      }
    } finally {
      setSummaryLoading(false);
      setSummaryVisible(false);
      navigation.navigate('ColetasMain');
    }
  };

  if (loading || !shipment) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color={DARK} />
      </View>
    );
  }

  const currentAddress = step === 'to_pickup' ? shipment.originAddress : shipment.destinationAddress;
  const currentLabel = step === 'to_pickup' ? `Coleta — ${shipment.clientName}` : 'Entrega na base';
  const elapsedSec = Math.round((Date.now() - startTimeRef.current) / 1000);
  const totalKm = routeDistanceKm(
    fullRouteCoords.length > 1 ? fullRouteCoords : [shipment.originCoord, shipment.destCoord],
  );

  const stops = [
    { key: 'pickup', coord: shipment.originCoord, done: step === 'to_delivery' },
    { key: 'delivery', coord: shipment.destCoord, done: false },
  ];

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Full-screen map */}
      <GoogleMapsMap ref={mapRef} style={styles.map} initialRegion={mapInitialRegion}>
        {/* Full route — gold */}
        {fullRouteCoords.length > 1 && (
          <MapPolyline id="full" coordinates={fullRouteCoords} strokeColor={GOLD} strokeWidth={4} />
        )}
        {/* Driver → current stop — dark */}
        {driverRouteCoords.length > 1 && (
          <MapPolyline id="driver" coordinates={driverRouteCoords} strokeColor={DARK} strokeWidth={3} />
        )}
        {/* Stop markers */}
        {stops.map((s) => (
          <MapMarker key={s.key} id={`stop-${s.key}`} coordinate={s.coord} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.stopMarker, s.done && styles.stopMarkerDone]}>
              <MaterialIcons name={s.done ? 'check' : 'inventory-2'} size={18} color="#FFF" />
            </View>
          </MapMarker>
        ))}
        {/* Driver marker */}
        {driverPos && (
          <MapMarker id="driver-pos" coordinate={driverPos} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverPulse}>
              <View style={styles.driverDot}>
                <MaterialIcons name="play-arrow" size={18} color="#FFF" />
              </View>
            </View>
          </MapMarker>
        )}
      </GoogleMapsMap>

      {/* Back button */}
      <SafeAreaView style={styles.backSafe} edges={['top']} pointerEvents="box-none">
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={20} color={DARK} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Sidebar — stops */}
      <View style={styles.sidebar} pointerEvents="box-none">
        {stops.map((s, i) => (
          <View key={s.key} style={styles.sidebarItem}>
            <View style={[styles.sidebarBtn, s.done && styles.sidebarBtnDone]}>
              <MaterialIcons name={s.done ? 'check' : 'inventory-2'} size={20} color="#FFF" />
            </View>
            {i < stops.length - 1 && <View style={styles.sidebarLine} />}
          </View>
        ))}
      </View>

      {/* Bottom card */}
      <View style={styles.bottomCard}>
        <View style={styles.bottomTopRow}>
          <View style={styles.stepPill}>
            <View style={[styles.pillDot, { backgroundColor: step === 'to_pickup' ? GOLD : '#34D399' }]} />
            <Text style={styles.pillText}>{step === 'to_pickup' ? 'Coleta' : 'Entrega'}</Text>
          </View>
          {etaSeconds > 0 && (
            <View style={styles.etaBadge}>
              <Text style={styles.etaText}>{formatEta(etaSeconds)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.stopLabel} numberOfLines={1}>{currentLabel}</Text>
        <View style={styles.addressRow}>
          <MaterialIcons name="place" size={14} color="#9CA3AF" />
          <Text style={styles.addressText} numberOfLines={1}>{currentAddress}</Text>
        </View>
        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: step === 'to_pickup' ? '30%' : '70%' }]} />
          </View>
          <Text style={styles.progressCount}>{step === 'to_pickup' ? '1' : '2'}/2</Text>
        </View>
        <TouchableOpacity
          style={styles.confirmBtn}
          activeOpacity={0.85}
          onPress={() => step === 'to_pickup' ? setPickupVisible(true) : setDeliveryVisible(true)}
        >
          <Text style={styles.confirmBtnText}>
            {step === 'to_pickup' ? 'Confirmar coleta' : 'Confirmar entrega'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Pickup modal ── */}
      <Modal visible={pickupVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kbav}>
          <View style={styles.modalOverlay}>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Deseja confirmar a Coleta?</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setPickupVisible(false)} activeOpacity={0.7}>
                  <MaterialIcons name="close" size={18} color="#374151" />
                </TouchableOpacity>
              </View>
              <View style={styles.divider} />
              <ScrollView keyboardShouldPersistTaps="handled">
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
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setPickupVisible(false)} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>Não, voltar</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Delivery modal ── */}
      <Modal visible={deliveryVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kbav}>
          <View style={styles.modalOverlay}>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>Confirmar entrega na base</Text>
                  <Text style={styles.sheetSub}>Insira o código informado pela base{'\n'}para confirmar que o item foi entregue.</Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setDeliveryVisible(false)} activeOpacity={0.7}>
                  <MaterialIcons name="close" size={18} color="#374151" />
                </TouchableOpacity>
              </View>
              <View style={styles.divider} />
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.fieldLabel}>Código de entrega</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: BASE132"
                  placeholderTextColor="#9CA3AF"
                  value={deliveryCode}
                  onChangeText={setDeliveryCode}
                  autoCapitalize="characters"
                />
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
                  style={[styles.primaryBtn, !deliveryCode.trim() && styles.btnDisabled]}
                  onPress={confirmDelivery}
                  disabled={!deliveryCode.trim() || deliveryLoading}
                  activeOpacity={0.85}
                >
                  {deliveryLoading
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <Text style={styles.primaryBtnText}>Confirmar entrega</Text>
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
      <Modal visible={summaryVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kbav}>
          <View style={styles.modalOverlay}>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>Entrega concluída!</Text>
                  <Text style={styles.sheetSub}>Todas as entregas do dia foram{'\n'}registradas com sucesso.</Text>
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
  root: { flex: 1 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  map: { flex: 1 },

  backSafe: { position: 'absolute', top: 0, left: 0, right: 0 },
  backBtn: {
    margin: 16, width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },

  sidebar: { position: 'absolute', left: 16, top: '28%', alignItems: 'center' },
  sidebarItem: { alignItems: 'center' },
  sidebarBtn: {
    width: 46, height: 46, borderRadius: 10, backgroundColor: GOLD,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 5,
  },
  sidebarBtnDone: { backgroundColor: DARK },
  sidebarLine: { width: 2, height: 20, backgroundColor: DARK },

  stopMarker: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center',
  },
  stopMarkerDone: { backgroundColor: DARK },

  driverPulse: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(156,163,175,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  driverDot: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: DARK, alignItems: 'center', justifyContent: 'center',
  },

  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, elevation: 10,
  },
  bottomTopRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
  },
  stepPill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  etaBadge: { backgroundColor: DARK, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  etaText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  stopLabel: { fontSize: 22, fontWeight: '700', color: DARK, marginBottom: 6 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  addressText: { fontSize: 14, color: '#6B7280', flex: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  progressBar: { flex: 1, height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: GOLD, borderRadius: 3 },
  progressCount: { fontSize: 13, fontWeight: '600', color: DARK },
  confirmBtn: { backgroundColor: DARK, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

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
