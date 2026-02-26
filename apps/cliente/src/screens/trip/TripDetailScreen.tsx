import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ActivitiesStackParamList } from '../../navigation/ActivitiesStackTypes';
import { supabase } from '../../lib/supabase';
import { getRoutePolyline, type RoutePoint } from '../../lib/route';

type Props = NativeStackScreenProps<ActivitiesStackParamList, 'TripDetail'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDetailDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const months = 'Jan Fev Mar Abr Mai Jun Jul Ago Set Out Nov Dez'.split(' ');
  const month = months[d.getMonth()];
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${day} ${month} • ${hours}:${minutes}`;
}

type BookingDetail = {
  id: string;
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  amount_cents: number;
  status: string;
  created_at: string;
  departure_time: string;
  arrival_time: string;
  driver_name: string;
  driver_avatar_url: string | null;
};

export function TripDetailScreen({ navigation, route }: Props) {
  const bookingId = route.params?.bookingId ?? '';
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeCoords, setRouteCoords] = useState<RoutePoint[] | null>(null);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: booking, error: bookErr } = await supabase
        .from('bookings')
        .select('id, origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng, amount_cents, status, created_at, scheduled_trip_id')
        .eq('id', bookingId)
        .eq('user_id', user.id)
        .single();
      if (cancelled || bookErr || !booking) {
        setLoading(false);
        return;
      }
      const { data: trip } = await supabase
        .from('scheduled_trips')
        .select('departure_at, arrival_at, driver_id')
        .eq('id', booking.scheduled_trip_id)
        .single();
      let driverName = 'Motorista';
      let driverAvatarUrl: string | null = null;
      if (trip?.driver_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', trip.driver_id)
          .single();
        driverName = profile?.full_name ?? driverName;
        driverAvatarUrl = profile?.avatar_url ?? null;
      }
      const depTime = trip?.departure_at ? new Date(trip.departure_at).toTimeString().slice(0, 5) : '—';
      const arrTime = trip?.arrival_at ? new Date(trip.arrival_at).toTimeString().slice(0, 5) : '—';
      setDetail({
        id: booking.id,
        origin_address: booking.origin_address,
        origin_lat: booking.origin_lat,
        origin_lng: booking.origin_lng,
        destination_address: booking.destination_address,
        destination_lat: booking.destination_lat,
        destination_lng: booking.destination_lng,
        amount_cents: booking.amount_cents,
        status: booking.status,
        created_at: booking.created_at,
        departure_time: depTime,
        arrival_time: arrTime,
        driver_name: driverName,
        driver_avatar_url: driverAvatarUrl,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  useEffect(() => {
    if (!detail) return;
    let cancelled = false;
    getRoutePolyline(
      { latitude: detail.origin_lat, longitude: detail.origin_lng },
      { latitude: detail.destination_lat, longitude: detail.destination_lng }
    ).then((coords) => {
      if (!cancelled && coords?.length) setRouteCoords(coords);
    });
    return () => { cancelled = true; };
  }, [detail?.origin_lat, detail?.origin_lng, detail?.destination_lat, detail?.destination_lng]);

  const mapRegion = useMemo(() => {
    if (!detail) return null;
    const latMin = Math.min(detail.origin_lat, detail.destination_lat);
    const latMax = Math.max(detail.origin_lat, detail.destination_lat);
    const lngMin = Math.min(detail.origin_lng, detail.destination_lng);
    const lngMax = Math.max(detail.origin_lng, detail.destination_lng);
    const padding = 0.01;
    return {
      latitude: (latMin + latMax) / 2,
      longitude: (lngMin + lngMax) / 2,
      latitudeDelta: Math.max(0.05, latMax - latMin + padding * 2),
      longitudeDelta: Math.max(0.05, lngMax - lngMin + padding * 2),
    };
  }, [detail]);

  const isInProgress = detail?.status && !['paid', 'cancelled'].includes(detail.status);
  const isCompleted = detail?.status === 'paid';

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="close" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhes da Viagem</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.black} />
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="close" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhes da Viagem</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.placeholder}>Viagem não encontrada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const avatarUri = detail.driver_avatar_url
    ? (detail.driver_avatar_url.startsWith('http')
        ? detail.driver_avatar_url
        : `${supabaseUrl}/storage/v1/object/public/avatars/${detail.driver_avatar_url}`)
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="close" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes da Viagem</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {mapRegion && (
          <View style={styles.mapWrap}>
            <MapView style={styles.map} initialRegion={mapRegion} scrollEnabled={false}>
              <Marker
                coordinate={{ latitude: detail.origin_lat, longitude: detail.origin_lng }}
                anchor={{ x: 0.5, y: 1 }}
                pinColor="#0d0d0d"
              />
              <Marker
                coordinate={{ latitude: detail.destination_lat, longitude: detail.destination_lng }}
                anchor={{ x: 0.5, y: 1 }}
                pinColor="#dc2626"
              />
              {routeCoords && routeCoords.length > 0 && (
                <Polyline coordinates={routeCoords} strokeColor={COLORS.black} strokeWidth={4} />
              )}
            </MapView>
            <TouchableOpacity style={styles.trackButton} activeOpacity={0.8}>
              <MaterialIcons name="explore" size={20} color={COLORS.neutral700} />
              <Text style={styles.trackButtonText}>Acompanhar em tempo real</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTitle}>Corrida TakeMe</Text>
              <Text style={styles.cardSubtitle}>com {detail.driver_name}</Text>
            </View>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.driverAvatar} />
            ) : (
              <View style={[styles.driverAvatar, styles.driverAvatarFallback]}>
                <Text style={styles.driverAvatarInitials}>{getInitials(detail.driver_name)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardDate}>{formatDetailDate(detail.created_at)}</Text>
          <View style={styles.cardStatusRow}>
            <Text style={styles.cardPrice}>R$ {(detail.amount_cents / 100).toFixed(2)}</Text>
            <Text style={[styles.cardStatus, isCompleted ? styles.cardStatusCompleted : styles.cardStatusProgress]}>
              {isCompleted ? 'Concluído' : 'Em andamento'}
            </Text>
          </View>
          <TouchableOpacity style={styles.receiptButton} activeOpacity={0.8}>
            <MaterialIcons name="receipt" size={20} color={COLORS.neutral700} />
            <Text style={styles.receiptButtonText}>Recibo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.routeSection}>
          <View style={styles.routeRow}>
            <View style={styles.routeIconCircle} />
            <Text style={styles.routeAddress} numberOfLines={2}>{detail.origin_address}</Text>
            <Text style={styles.routeTime}>{detail.departure_time}</Text>
          </View>
          <View style={styles.routeRow}>
            <View style={styles.routeIconSquare} />
            <Text style={styles.routeAddress} numberOfLines={2}>{detail.destination_address}</Text>
            <Text style={styles.routeTime}>{detail.arrival_time}</Text>
          </View>
        </View>

        <View style={styles.actionsSection}>
          <View style={styles.actionRow}>
            <MaterialIcons name="card-giftcard" size={20} color={COLORS.neutral700} />
            <Text style={styles.actionLabel}>Nenhuma gorjeta enviada</Text>
            <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
              <Text style={styles.actionButtonText}>Gorjeta</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.actionRow}>
            <MaterialIcons name="star-outline" size={20} color={COLORS.neutral700} />
            <Text style={styles.actionLabel}>Sem avaliação</Text>
            <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
              <Text style={styles.actionButtonText}>Avaliar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isInProgress && (
          <TouchableOpacity style={styles.cancelButton} activeOpacity={0.8}>
            <Text style={styles.cancelButtonText}>Cancelar viagem</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral300,
  },
  closeButton: { padding: 4, width: 32 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.black, flex: 1, textAlign: 'center' },
  headerSpacer: { width: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  placeholder: { fontSize: 15, color: COLORS.neutral700 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  mapWrap: { height: 200, paddingHorizontal: 24, paddingTop: 16 },
  map: { width: '100%', height: '100%', borderRadius: 12 },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
  },
  trackButtonText: { fontSize: 14, fontWeight: '500', color: COLORS.neutral700 },
  card: {
    marginHorizontal: 24,
    marginTop: 20,
    padding: 16,
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitleWrap: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.black },
  cardSubtitle: { fontSize: 16, fontWeight: '500', color: COLORS.black, marginTop: 2 },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FBBF24',
    overflow: 'hidden',
  },
  driverAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  driverAvatarInitials: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  cardDate: { fontSize: 14, color: COLORS.neutral700, marginTop: 12 },
  cardStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  cardPrice: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  cardStatus: { fontSize: 14, fontWeight: '600' },
  cardStatusCompleted: { color: '#16a34a' },
  cardStatusProgress: { color: '#A37E38' },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
  },
  receiptButtonText: { fontSize: 14, fontWeight: '500', color: COLORS.neutral700 },
  routeSection: { marginHorizontal: 24, marginTop: 24, gap: 16 },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeIconCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.neutral700,
  },
  routeIconSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: COLORS.neutral700,
  },
  routeAddress: { flex: 1, fontSize: 14, color: COLORS.black },
  routeTime: { fontSize: 14, fontWeight: '600', color: COLORS.black },
  actionsSection: { marginHorizontal: 24, marginTop: 24, gap: 12 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionLabel: { flex: 1, fontSize: 14, color: COLORS.neutral700 },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.neutral300,
    borderRadius: 8,
  },
  actionButtonText: { fontSize: 14, fontWeight: '500', color: COLORS.black },
  cancelButton: {
    marginHorizontal: 24,
    marginTop: 24,
    paddingVertical: 16,
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#dc2626' },
});
