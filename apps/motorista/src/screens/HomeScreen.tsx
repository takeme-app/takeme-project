import { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
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
import { MapboxMap, MapboxMarker } from '../components/mapbox';

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
  bagsCount: number;
};

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
  const [routesCount, setRoutesCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [cnhOk, setCnhOk] = useState(false);
  const [cnhBackOk, setCnhBackOk] = useState(false);
  const [pixOk, setPixOk] = useState(false);
  const [hasCompleteVehicle, setHasCompleteVehicle] = useState(false);
  const [available, setAvailable] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) { setUserId(null); setLoading(false); return; }
    setUserId(user.id);

    // Worker profile
    const { data: wr } = await supabase
      .from('worker_profiles')
      .select('cnh_document_url, cnh_document_back_url, pix_key, is_available_for_requests')
      .eq('id', user.id)
      .maybeSingle();
    const w = wr as {
      cnh_document_url?: string | null;
      cnh_document_back_url?: string | null;
      pix_key?: string | null;
      is_available_for_requests?: boolean | null;
    } | null;
    setCnhOk(Boolean(w?.cnh_document_url?.trim()));
    setCnhBackOk(Boolean(w?.cnh_document_back_url?.trim()));
    setPixOk(Boolean(w?.pix_key?.trim()));
    setAvailable(w?.is_available_for_requests ?? false);

    // Routes count
    const { count: rCount } = await supabase
      .from('worker_routes').select('id', { count: 'exact', head: true }).eq('worker_id', user.id).eq('is_active', true);
    setRoutesCount(rCount ?? 0);

    // Complete vehicle check (at least one active vehicle with all required fields)
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('model, plate, year, passenger_capacity')
      .eq('worker_id', user.id)
      .eq('is_active', true);
    const completeVehicle = ((vehicles ?? []) as { model?: string | null; plate?: string | null; year?: number | null; passenger_capacity?: number | null }[])
      .some(v => Boolean(v.model?.trim()) && Boolean(v.plate?.trim()) && Boolean(v.year) && Boolean(v.passenger_capacity));
    setHasCompleteVehicle(completeVehicle);

    // Active trip
    const { data: tripData } = await supabase
      .from('scheduled_trips')
      .select('id, origin_address, destination_address, departure_at')
      .eq('driver_id', user.id)
      .eq('status', 'active')
      .order('departure_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (tripData) {
      const t = tripData as { id: string; origin_address: string; destination_address: string; departure_at: string };
      const { data: bkgs } = await supabase
        .from('bookings')
        .select('passenger_count, bags_count')
        .eq('scheduled_trip_id', t.id)
        .in('status', ['confirmed', 'paid']);
      const passengerCount = ((bkgs ?? []) as { passenger_count?: number }[]).reduce((s, b) => s + (b.passenger_count ?? 0), 0);
      const bagsCount = ((bkgs ?? []) as { bags_count?: number }[]).reduce((s, b) => s + (b.bags_count ?? 0), 0);
      setActiveTrip({ ...t, passengerCount, bagsCount });
    } else {
      setActiveTrip(null);
    }

    // Pending requests count (bookings on own trips + pending_review shipments)
    const { count: bCount } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    const { count: sCount } = await supabase
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_review');
    const { count: eCount } = await supabase
      .from('excursion_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    setPendingCount((bCount ?? 0) + (sCount ?? 0) + (eCount ?? 0));

    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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

  const endTrip = async () => {
    if (!activeTrip) return;
    await supabase
      .from('scheduled_trips')
      .update({ status: 'completed', updated_at: new Date().toISOString() } as never)
      .eq('id', activeTrip.id);
    setActiveTrip(null);
  };

  const goRoutes = () => navigation.navigate('Profile', { screen: 'WorkerRoutes' });
  const goSchedule = () => navigation.navigate('Profile', { screen: 'TripSchedule' });
  const goPending = () => navigation.navigate('PendingRequests');

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.center}><ActivityIndicator size="large" color="#111827" /></View>
      </SafeAreaView>
    );
  }

  const showBanner = !cnhOk || !pixOk || !hasCompleteVehicle || routesCount < 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Banner de onboarding */}
        {showBanner && (
          <TouchableOpacity style={styles.banner} onPress={goRoutes} activeOpacity={0.85}>
            <Text style={styles.bannerText}>
              {!cnhOk
                ? 'Adicione seus documentos (CNH) para começar a receber solicitações.'
                : !pixOk
                ? 'Cadastre sua chave PIX para começar a receber solicitações.'
                : !hasCompleteVehicle
                ? 'Cadastre um veículo para começar a receber solicitações.'
                : 'Cadastre ao menos uma rota para começar a receber solicitações.'}
            </Text>
            <View style={styles.bannerArrow}>
              <MaterialIcons name="arrow-forward" size={20} color="#92400E" />
            </View>
          </TouchableOpacity>
        )}

        {/* Card da viagem ativa */}
        {activeTrip && (
          <View style={styles.tripCard}>
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
              <View style={styles.metaItem}>
                <MaterialIcons name="inventory-2" size={18} color="#6B7280" />
                <View>
                  <Text style={styles.metaLabel}>Encomendas</Text>
                  <Text style={styles.metaValue}>{activeTrip.bagsCount}</Text>
                </View>
              </View>
            </View>

            {/* Mapa da viagem ativa */}
            <View style={styles.mapPlaceholder}>
              <MapboxMap
                style={{ flex: 1, borderRadius: 12 }}
                initialRegion={{
                  latitude: -7.3289,
                  longitude: -35.3328,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                scrollEnabled={false}
              >
                <MapboxMarker
                  id="origin"
                  coordinate={{ latitude: -7.3289, longitude: -35.3328 }}
                  pinColor="#111827"
                />
                <MapboxMarker
                  id="dest"
                  coordinate={{ latitude: -7.29, longitude: -35.30 }}
                  pinColor="#C9A227"
                />
              </MapboxMap>
            </View>

            <TouchableOpacity style={styles.mapBtn} activeOpacity={0.85} onPress={() => activeTrip && navigation.navigate('ActiveTrip', { tripId: activeTrip.id })}>
              <Text style={styles.mapBtnText}>Ver rota no mapa</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.endTripBtn} onPress={endTrip} activeOpacity={0.85}>
              <Text style={styles.endTripBtnText}>Encerrar viagem</Text>
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
            <Text style={styles.quickLabel}>Solicitações{'\n'}pendentes</Text>
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
            value={available}
            onValueChange={onToggleAvailable}
            disabled={toggleLoading}
            trackColor={{ false: '#E5E7EB', true: '#111827' }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={styles.divider} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12 + SCREEN_TOP_EXTRA_PADDING },
  banner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEF9C3', borderWidth: 1, borderColor: '#EAB308',
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 20, gap: 12,
  },
  bannerText: { flex: 1, fontSize: 14, color: '#78350F', lineHeight: 20, fontWeight: '500' },
  bannerArrow: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#FDE68A',
    alignItems: 'center', justifyContent: 'center',
  },

  // Trip card
  tripCard: {
    borderWidth: 1.5, borderColor: '#111827', borderRadius: 16,
    padding: 20, marginBottom: 24,
  },
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
  mapPlaceholder: {
    height: 140, backgroundColor: '#E5E7EB', borderRadius: 12,
    marginBottom: 14, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', position: 'relative',
  },
  mapCarBubble: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#111827',
    alignItems: 'center', justifyContent: 'center',
    position: 'absolute', left: '35%', top: '35%',
  },
  mapDestDot: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#3B82F6',
    borderWidth: 3, borderColor: '#FFFFFF',
    position: 'absolute', right: '28%', top: '40%',
  },
  mapBtn: {
    borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 10,
  },
  mapBtnText: { fontSize: 15, fontWeight: '600', color: '#111827' },
  endTripBtn: {
    backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  endTripBtnText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },

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
});
