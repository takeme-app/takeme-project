import { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { Text } from './Text';
import { MaterialIcons } from '@expo/vector-icons';
import {
  loadClientScheduledTrips,
  compareTripsByDepartureAndBadge,
  tripFitsPassengersAndBags,
  type ClientScheduledTripItem,
} from '../lib/clientScheduledTrips';
import { parseTimeSlotRange, toISODateFromUtcIso } from '../lib/dateTimeSlots';
import { formatDriverRatingLabel, formatTripFareBrl } from '../lib/tripDriverDisplay';
import type { SelectedPlaces } from './AddressSelectionScreen';
import type { WhenTimeResult } from '../hooks/useWhenTimeSelection';

const ROUTE_MATCH_DEGREES = 0.15;
const LIST_PASSENGERS = 1;
const LIST_BAGS = 0;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

const COLORS = {
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type TripListFooterMeta =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; tripCount: number; selectedTrip: ClientScheduledTripItem | null; error: string | null };

type Props = {
  places: SelectedPlaces;
  /** Lista filtra por data/faixa quando o utilizador agenda (alinhado a PlanRideScreen). */
  when: WhenTimeResult;
  onScheduleLater: () => void;
  /** Atualiza o estado do rodapé (visibilidade / rótulo) na tela pai. */
  onListFooterMetaChange?: (meta: TripListFooterMeta) => void;
};

export function TripResultsList({ places, when, onScheduleLater, onListFooterMetaChange }: Props) {
  const [allTrips, setAllTrips] = useState<ClientScheduledTripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadClientScheduledTrips().then(({ items, error: err }) => {
      setAllTrips(items);
      setError(err);
      setLoading(false);
    });
  }, []);

  // Chave estável: o pai costuma passar um novo objeto `places` a cada render; usar a referência
  // de `places` no useMemo abaixo gerava novo `filteredTrips` sempre e reativava o layout effect
  // que chama `onListFooterMetaChange` → setState no pai → loop "Maximum update depth exceeded".
  const scheduleKey =
    when.whenOption === 'later' && when.scheduledDateId && when.scheduledTimeSlot
      ? `${when.scheduledDateId}|${when.scheduledTimeSlot}`
      : 'now';
  const placesKey = `${places.origin.latitude},${places.origin.longitude},${places.destination.latitude},${places.destination.longitude}|${scheduleKey}`;

  const filteredTrips = useMemo(() => {
    const { origin, destination } = places;
    let list = allTrips.filter(
      (t) =>
        Math.abs(t.origin_lat - origin.latitude) <= ROUTE_MATCH_DEGREES &&
        Math.abs(t.origin_lng - origin.longitude) <= ROUTE_MATCH_DEGREES &&
        Math.abs(t.latitude - destination.latitude) <= ROUTE_MATCH_DEGREES &&
        Math.abs(t.longitude - destination.longitude) <= ROUTE_MATCH_DEGREES &&
        tripFitsPassengersAndBags(t, LIST_PASSENGERS, LIST_BAGS),
    );
    if (when.whenOption === 'later' && when.scheduledDateId && when.scheduledTimeSlot && list.length > 0) {
      const dateId = when.scheduledDateId;
      const slotStr = when.scheduledTimeSlot;
      list = list.filter((t) => {
        if (!t.departure_at) return false;
        const tripDate = toISODateFromUtcIso(t.departure_at);
        if (tripDate !== dateId) return false;
        const slot = parseTimeSlotRange(slotStr);
        if (!slot) return true;
        const dep = new Date(t.departure_at);
        const depMinutes = dep.getHours() * 60 + dep.getMinutes();
        return depMinutes >= slot.startMinutes && depMinutes < slot.endMinutes;
      });
    }
    return [...list].sort(compareTripsByDepartureAndBadge);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `placesKey` resume coords + janela temporal; `places` muda de referência.
  }, [allTrips, placesKey]);

  useEffect(() => {
    setSelectedTripId(null);
  }, [placesKey]);

  useEffect(() => {
    if (selectedTripId && !filteredTrips.some((t) => t.id === selectedTripId)) {
      setSelectedTripId(null);
    }
  }, [filteredTrips, selectedTripId]);

  useLayoutEffect(() => {
    if (!onListFooterMetaChange) return;
    if (loading) {
      onListFooterMetaChange({ phase: 'loading' });
      return;
    }
    if (error) {
      onListFooterMetaChange({ phase: 'ready', tripCount: 0, selectedTrip: null, error });
      return;
    }
    const selectedTrip =
      selectedTripId != null ? filteredTrips.find((t) => t.id === selectedTripId) ?? null : null;
    onListFooterMetaChange({ phase: 'ready', tripCount: filteredTrips.length, selectedTrip, error: null });
  }, [loading, error, filteredTrips, selectedTripId, onListFooterMetaChange]);

  useEffect(() => {
    if (!onListFooterMetaChange) return;
    return () => {
      onListFooterMetaChange({ phase: 'idle' });
    };
  }, [onListFooterMetaChange]);

  if (loading) {
    return (
      <View style={styles.statusRow}>
        <ActivityIndicator size="small" color={COLORS.black} />
        <Text style={styles.statusText}>Carregando viagens...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.statusRow}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (filteredTrips.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>Nenhuma viagem encontrada para esta rota no momento.</Text>
        <TouchableOpacity style={styles.textLinkRow} onPress={onScheduleLater} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8 }}>
          <Text style={styles.textLink}>Agendar para outro dia</Text>
          <MaterialIcons name="chevron-right" size={20} color={COLORS.neutral700} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Viagens disponíveis</Text>
      <Text style={styles.sectionSubtitle}>Toque na viagem para selecionar; em seguida confirme no rodapé</Text>
      {filteredTrips.map((trip) => {
        return (
          <TouchableOpacity
            key={trip.id}
            style={[styles.tripCard, selectedTripId === trip.id && styles.tripCardSelected]}
            activeOpacity={0.8}
            onPress={() => setSelectedTripId(trip.id)}
          >
            <View style={styles.topRow}>
              {trip.driverAvatarUrl ? (
                <Image
                  source={{
                    uri: trip.driverAvatarUrl.startsWith('http')
                      ? trip.driverAvatarUrl
                      : `${supabaseUrl}/storage/v1/object/public/avatars/${trip.driverAvatarUrl}`,
                  }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitials}>{getInitials(trip.driverName)}</Text>
                </View>
              )}
              <View style={styles.driverWrap}>
                <Text style={styles.driverName}>{trip.driverName}</Text>
                <Text style={styles.driverRating}>
                  {'★ '}
                  {formatDriverRatingLabel(trip.rating)}
                </Text>
              </View>
              <View style={styles.badge}>
                <Text style={[styles.badgeText, trip.badge === 'Take Me' ? styles.badgeTakeMe : styles.badgeParceiro]}>
                  {trip.badge}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.timesRow}>
              <View style={styles.timeCol}>
                <Text style={styles.timeLabel}>Saída</Text>
                <Text style={styles.timeValue}>{trip.departure}</Text>
              </View>
              <View style={styles.timeCol}>
                <Text style={styles.timeLabel}>Chegada</Text>
                <Text style={styles.timeValue}>{trip.arrival}</Text>
              </View>
            </View>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Valor da corrida</Text>
              <Text style={styles.fareValue}>{formatTripFareBrl(trip.amount_cents)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.capacityRow}>
              <View style={styles.capacityItem}>
                <MaterialIcons name="people" size={18} color={COLORS.neutral700} />
                <Text style={styles.capacityText}>{trip.seats} lugares</Text>
              </View>
              <View style={styles.capacityItem}>
                <MaterialIcons name="work-outline" size={18} color={COLORS.neutral700} />
                <Text style={styles.capacityText}>{trip.bags} malas</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity style={styles.textLinkRow} onPress={onScheduleLater} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8 }}>
        <Text style={styles.textLink}>Prefiro agendar para outro horário</Text>
        <MaterialIcons name="chevron-right" size={20} color={COLORS.neutral700} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16 },
  statusText: { fontSize: 14, color: COLORS.neutral700 },
  errorText: { fontSize: 14, color: '#DC2626' },
  emptyWrap: { paddingVertical: 16 },
  emptyText: { fontSize: 14, color: COLORS.neutral700, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.black, marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: COLORS.neutral700, marginBottom: 12 },

  tripCard: {
    backgroundColor: COLORS.neutral300,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tripCardSelected: {
    borderColor: COLORS.black,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  avatarFallback: { backgroundColor: COLORS.neutral400, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 14, fontWeight: '700', color: COLORS.black },
  driverWrap: { flex: 1 },
  driverName: { fontSize: 15, fontWeight: '600', color: COLORS.black },
  driverRating: { fontSize: 13, color: COLORS.neutral700, marginTop: 2 },
  badge: { backgroundColor: COLORS.neutral400, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  badgeTakeMe: { color: '#1B5E20' },
  badgeParceiro: { color: COLORS.neutral700 },
  divider: { height: 1, backgroundColor: COLORS.neutral400, marginVertical: 8 },
  timesRow: { flexDirection: 'row', gap: 24 },
  timeCol: {},
  timeLabel: { fontSize: 12, color: COLORS.neutral700, marginBottom: 2 },
  timeValue: { fontSize: 15, fontWeight: '600', color: COLORS.black },
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  fareLabel: { fontSize: 14, fontWeight: '600', color: COLORS.black },
  fareValue: { fontSize: 16, fontWeight: '700', color: '#EA580C' },
  capacityRow: { flexDirection: 'row', gap: 20 },
  capacityItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  capacityText: { fontSize: 13, color: COLORS.neutral700 },

  textLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 10,
    gap: 2,
  },
  textLink: { fontSize: 14, fontWeight: '600', color: COLORS.neutral700 },
});
