import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Text } from '../components/Text';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { storageUrl } from '../utils/storageUrl';

type Props = NativeStackScreenProps<RootStackParamList, 'PendingRequests'>;

const GOLD = '#C9A227';

type RequestItem = {
  id: string;
  /** scheduledTripId — para navegar para TripDetail após aceitar */
  scheduledTripId: string;
  origin: string;
  destination: string;
  /** Horário de partida da viagem (ISO) */
  departureAt: string;
  timeLabel: string;
  priceCents: number | null;
  userName: string;
  userAvatar: string | null;
  userRating: number | null;
  minutesAgo: number;
  /** Número de passageiros */
  passengerCount: number;
  /** 30min antes da partida */
  expiresAt: Date;
  rawId: string;
};

function minutesAgoFn(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function formatCents(cents: number | null): string {
  if (cents == null) return 'A combinar';
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function shortAddr(addr: string): string {
  return addr.split(',')[0]?.trim() ?? addr;
}

/** Formata countdown em MM:SS. Retorna null se expirado. */
function formatCountdown(expiresAt: Date): { label: string; urgent: boolean } | null {
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return null;
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const label = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return { label, urgent: mins < 5 };
}

export function PendingRequestsScreen({ navigation }: Props) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  // Tick a cada segundo para atualizar countdowns
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) { setItems([]); setLoading(false); return; }
    setUserId(user.id);

    // Bookings pendentes nas viagens deste motorista
    const { data: bookings } = await supabase
      .from('bookings')
      .select(
        'id, origin_address, destination_address, passenger_count, amount_cents, created_at, scheduled_trip_id, user_id, scheduled_trips!inner(departure_at, driver_id)'
      )
      .eq('status', 'pending')
      .limit(50);

    const now = Date.now();
    const filtered = ((bookings ?? []) as unknown[]).filter((b: unknown) => {
      const row = b as { scheduled_trips?: { driver_id?: string; departure_at?: string } };
      if (row.scheduled_trips?.driver_id !== user.id) return false;
      // Exclui viagens cuja janela de aceite já fechou (30min antes da partida)
      const depAt = row.scheduled_trips?.departure_at;
      if (!depAt) return true;
      const expires = new Date(depAt).getTime() - 30 * 60 * 1000;
      return expires > now;
    });

    const all: RequestItem[] = [];

    for (const b of filtered) {
      const row = b as {
        id: string; origin_address: string; destination_address: string;
        passenger_count: number; amount_cents: number; created_at: string;
        scheduled_trip_id: string; user_id: string;
        scheduled_trips: { departure_at: string };
      };
      const { data: prof } = await supabase
        .from('profiles').select('full_name, avatar_url, rating').eq('id', row.user_id).maybeSingle();
      const p = prof as { full_name?: string; avatar_url?: string; rating?: number } | null;
      const depAt = row.scheduled_trips?.departure_at;
      const expiresAt = new Date(new Date(depAt).getTime() - 30 * 60 * 1000);

      all.push({
        id: `booking_${row.id}`,
        rawId: row.id,
        scheduledTripId: row.scheduled_trip_id,
        origin: row.origin_address,
        destination: row.destination_address,
        departureAt: depAt,
        timeLabel: formatTime(depAt),
        priceCents: row.amount_cents,
        userName: p?.full_name ?? 'Passageiro',
        userAvatar: p?.avatar_url ?? null,
        userRating: p?.rating != null ? Number(p.rating) : null,
        minutesAgo: minutesAgoFn(row.created_at),
        passengerCount: row.passenger_count,
        expiresAt,
      });
    }

    all.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
    setItems(all);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAction = async (item: RequestItem, accept: boolean) => {
    if (!userId) return;
    setActioning(item.id);
    const now = new Date().toISOString();
    try {
      await supabase
        .from('bookings')
        .update({ status: accept ? 'confirmed' : 'cancelled', updated_at: now } as never)
        .eq('id', item.rawId);

      // Atualiza worker_assignment se existir
      const { data: wa } = await supabase
        .from('worker_assignments')
        .select('id')
        .eq('worker_id', userId)
        .eq('entity_type', 'booking')
        .eq('entity_id', item.rawId)
        .maybeSingle();
      if (wa) {
        await supabase
          .from('worker_assignments')
          .update(accept
            ? { status: 'accepted' } as never
            : { status: 'rejected', rejected_at: now, rejection_reason: 'Recusado pelo motorista' } as never
          )
          .eq('id', (wa as { id: string }).id);
      }

      setItems((prev) => prev.filter((i) => i.id !== item.id));

      if (accept) {
        navigation.navigate('TripDetail', { tripId: item.scheduledTripId });
      }
    } finally {
      setActioning(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="close" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Viagens pendentes</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#111827" /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="check-circle-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>Nenhuma solicitação de viagem pendente.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {items.map((item) => {
            const isActioning = actioning === item.id;
            const countdown = formatCountdown(item.expiresAt);

            return (
              <View key={item.id} style={styles.card}>
                {/* Header: badge Viagem + countdown */}
                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <MaterialIcons name="directions-car" size={13} color="#1D4ED8" />
                    <Text style={styles.badgeText}>Viagem</Text>
                  </View>
                  {countdown ? (
                    <View style={[styles.countdownBadge, countdown.urgent && styles.countdownBadgeUrgent]}>
                      <MaterialIcons name="timer" size={13} color={countdown.urgent ? '#fff' : '#92400E'} />
                      <Text style={[styles.countdownText, countdown.urgent && styles.countdownTextUrgent]}>
                        {countdown.label}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.expiredBadge}>
                      <Text style={styles.expiredText}>Expirado</Text>
                    </View>
                  )}
                </View>

                {/* Rota */}
                <View style={styles.routeRow}>
                  <View style={styles.routeDot} />
                  <Text style={styles.routeOrigin} numberOfLines={1}>{shortAddr(item.origin)}</Text>
                </View>
                <View style={styles.routeConnectorRow}>
                  <View style={styles.routeConnector} />
                </View>
                <View style={styles.routeRow}>
                  <View style={[styles.routeDot, styles.routeDotDest]} />
                  <Text style={styles.routeDest} numberOfLines={1}>{shortAddr(item.destination)}</Text>
                </View>

                {/* Horário + passageiros + preço */}
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <MaterialIcons name="access-time" size={14} color="#6B7280" />
                    <Text style={styles.metaText}>{item.timeLabel}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <MaterialIcons name="people" size={14} color="#6B7280" />
                    <Text style={styles.metaText}>
                      {item.passengerCount} {item.passengerCount === 1 ? 'passageiro' : 'passageiros'}
                    </Text>
                  </View>
                  <Text style={styles.price}>{formatCents(item.priceCents)}</Text>
                </View>

                <View style={styles.divider} />

                {/* Usuário */}
                <View style={styles.userRow}>
                  {item.userAvatar ? (
                    <Image
                      source={{ uri: storageUrl('avatars', item.userAvatar) ?? undefined }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <MaterialIcons name="person" size={20} color="#9CA3AF" />
                    </View>
                  )}
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.userName}</Text>
                    <View style={styles.ratingRow}>
                      <MaterialIcons name="star" size={13} color={GOLD} />
                      <Text style={styles.ratingText}>
                        {item.userRating != null ? item.userRating.toFixed(1) : '—'}
                      </Text>
                      <Text style={styles.timeAgo}> · há {item.minutesAgo}min</Text>
                    </View>
                  </View>
                </View>

                {/* Botões */}
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={styles.btnRecusar}
                    onPress={() => handleAction(item, false)}
                    disabled={isActioning || !countdown}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.btnRecusarText}>Recusar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnAceitar, (isActioning || !countdown) && { opacity: 0.5 }]}
                    onPress={() => handleAction(item, true)}
                    disabled={isActioning || !countdown}
                    activeOpacity={0.85}
                  >
                    {isActioning
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.btnAceitarText}>Aceitar</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF', marginTop: 8 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, gap: 14 },

  // Card
  card: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 16 },

  // Badge row
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#DBEAFE', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  badgeText: { fontSize: 13, fontWeight: '600', color: '#1D4ED8' },
  countdownBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEF3C7', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  countdownBadgeUrgent: { backgroundColor: '#EF4444' },
  countdownText: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  countdownTextUrgent: { color: '#FFFFFF' },
  expiredBadge: {
    backgroundColor: '#F3F4F6', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  expiredText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },

  // Rota vertical
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#111827', flexShrink: 0,
  },
  routeDotDest: { borderRadius: 2 },
  routeConnectorRow: { paddingLeft: 4, paddingVertical: 3 },
  routeConnector: { width: 2, height: 14, backgroundColor: '#D1D5DB', marginLeft: 0 },
  routeOrigin: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  routeDest: { fontSize: 15, fontWeight: '600', color: '#374151', flex: 1 },

  // Meta
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginTop: 12, marginBottom: 14,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: '#6B7280' },
  price: { marginLeft: 'auto' as any, fontSize: 15, fontWeight: '700', color: '#111827' },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 14 },

  // User
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6' },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  timeAgo: { fontSize: 13, color: '#9CA3AF' },

  // Botões
  btnRow: { flexDirection: 'row', gap: 10 },
  btnRecusar: {
    flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  btnRecusarText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
  btnAceitar: {
    flex: 2, backgroundColor: '#111827', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  btnAceitarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
