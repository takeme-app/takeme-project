import { useState, useCallback } from 'react';
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

type RequestType = 'passageiro' | 'encomenda' | 'excursao' | 'dependente';

type RequestItem = {
  id: string;
  type: RequestType;
  origin: string;
  destination: string;
  timeLabel: string;
  priceCents: number | null;
  userName: string;
  userAvatar: string | null;
  userRating: number | null;
  minutesAgo: number;
  extraLabel: string;
};

const BADGE_COLORS: Record<RequestType, { bg: string; text: string }> = {
  passageiro: { bg: '#DBEAFE', text: '#1D4ED8' },
  encomenda:  { bg: '#FEF3C7', text: '#92400E' },
  excursao:   { bg: '#EDE9FE', text: '#7C3AED' },
  dependente: { bg: '#DBEAFE', text: '#0369A1' },
};

const BADGE_LABELS: Record<RequestType, string> = {
  passageiro: 'Passageiro',
  encomenda: 'Encomenda',
  excursao: 'Excursão',
  dependente: 'Dependente',
};

function minutesAgo(iso: string): number {
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
    return 'Hoje, ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function shortAddr(addr: string): string {
  const parts = addr.split(',');
  return parts[0]?.trim() ?? addr;
}

function packageLabel(size: string | null): string {
  if (size === 'pequeno') return 'Pacote pequeno';
  if (size === 'medio') return 'Pacote médio';
  if (size === 'grande') return 'Pacote grande';
  return 'Encomenda';
}

export function PendingRequestsScreen({ navigation }: Props) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) { setItems([]); setLoading(false); return; }
    setUserId(user.id);

    const all: RequestItem[] = [];

    // --- Passageiro: bookings pendentes nas viagens do motorista ---
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, origin_address, destination_address, passenger_count, amount_cents, created_at, scheduled_trip_id, user_id, scheduled_trips!inner(departure_at, driver_id)')
      .eq('status', 'pending')
      .limit(50);

    const bookingsFiltered = ((bookings ?? []) as unknown[]).filter((b: unknown) => {
      const row = b as { scheduled_trips?: { driver_id?: string } };
      return row.scheduled_trips?.driver_id === user.id;
    });

    for (const b of bookingsFiltered) {
      const row = b as {
        id: string; origin_address: string; destination_address: string;
        passenger_count: number; amount_cents: number; created_at: string;
        user_id: string;
        scheduled_trips: { departure_at: string };
      };
      const { data: prof } = await supabase
        .from('profiles').select('full_name, avatar_url, rating').eq('id', row.user_id).maybeSingle();
      const p = prof as { full_name?: string; avatar_url?: string; rating?: number } | null;
      all.push({
        id: `booking_${row.id}`,
        type: 'passageiro',
        origin: row.origin_address,
        destination: row.destination_address,
        timeLabel: formatTime(row.scheduled_trips?.departure_at ?? null),
        priceCents: row.amount_cents,
        userName: p?.full_name ?? 'Passageiro',
        userAvatar: p?.avatar_url ?? null,
        userRating: p?.rating != null ? Number(p.rating) : null,
        minutesAgo: minutesAgo(row.created_at),
        extraLabel: `${row.passenger_count} ${row.passenger_count === 1 ? 'passageiro' : 'passageiros'}`,
      });
    }

    // --- Encomenda: shipments pending_review ---
    const { data: shipments } = await supabase
      .from('shipments')
      .select('id, origin_address, destination_address, package_size, amount_cents, created_at, scheduled_at, user_id')
      .eq('status', 'pending_review')
      .limit(50);

    for (const s of (shipments ?? []) as {
      id: string; origin_address: string; destination_address: string;
      package_size: string | null; amount_cents: number; created_at: string;
      scheduled_at: string | null; user_id: string;
    }[]) {
      const { data: prof } = await supabase
        .from('profiles').select('full_name, avatar_url, rating').eq('id', s.user_id).maybeSingle();
      const p = prof as { full_name?: string; avatar_url?: string; rating?: number } | null;
      all.push({
        id: `shipment_${s.id}`,
        type: 'encomenda',
        origin: s.origin_address,
        destination: s.destination_address,
        timeLabel: formatTime(s.scheduled_at ?? s.created_at),
        priceCents: s.amount_cents,
        userName: p?.full_name ?? 'Solicitante',
        userAvatar: p?.avatar_url ?? null,
        userRating: p?.rating != null ? Number(p.rating) : null,
        minutesAgo: minutesAgo(s.created_at),
        extraLabel: packageLabel(s.package_size),
      });
    }

    // --- Excursão: excursion_requests pending ---
    const { data: excursions } = await supabase
      .from('excursion_requests')
      .select('id, destination, excursion_date, people_count, created_at, user_id')
      .eq('status', 'pending')
      .limit(50);

    for (const e of (excursions ?? []) as {
      id: string; destination: string; excursion_date: string;
      people_count: number; created_at: string; user_id: string;
    }[]) {
      const { data: prof } = await supabase
        .from('profiles').select('full_name, avatar_url, rating').eq('id', e.user_id).maybeSingle();
      const p = prof as { full_name?: string; avatar_url?: string; rating?: number } | null;
      const dateLabel = (() => {
        try { return new Date(e.excursion_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }
        catch { return e.excursion_date; }
      })();
      all.push({
        id: `excursion_${e.id}`,
        type: 'excursao',
        origin: '—',
        destination: e.destination,
        timeLabel: `Hoje, ${dateLabel}`,
        priceCents: null,
        userName: p?.full_name ?? 'Solicitante',
        userAvatar: p?.avatar_url ?? null,
        userRating: p?.rating != null ? Number(p.rating) : null,
        minutesAgo: minutesAgo(e.created_at),
        extraLabel: `${e.people_count} ${e.people_count === 1 ? 'pessoa' : 'pessoas'}`,
      });
    }

    all.sort((a, b) => a.minutesAgo - b.minutesAgo);
    setItems(all);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAction = async (item: RequestItem, accept: boolean) => {
    if (!userId) return;
    setActioning(item.id);
    try {
      const [tablePrefix, rawId] = item.id.split('_') as [string, string];
      const realId = item.id.replace(`${tablePrefix}_`, '');

      if (tablePrefix === 'booking') {
        await supabase.from('bookings').update({ status: accept ? 'confirmed' : 'cancelled', updated_at: new Date().toISOString() } as never).eq('id', realId);
      } else if (tablePrefix === 'shipment') {
        await supabase.from('shipments').update({
          status: accept ? 'confirmed' : 'cancelled',
          ...(accept ? { driver_id: userId, driver_accepted_at: new Date().toISOString() } : {}),
        } as never).eq('id', realId);
      } else if (tablePrefix === 'excursion') {
        await supabase.from('excursion_requests').update({
          status: accept ? 'contacted' : 'cancelled',
          ...(accept ? { driver_id: userId, driver_accepted_at: new Date().toISOString() } : {}),
        } as never).eq('id', realId);
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
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
        <Text style={styles.headerTitle}>Solicitações pendentes</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#111827" /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="check-circle-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>Nenhuma solicitação pendente.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {items.map((item) => {
            const badge = BADGE_COLORS[item.type];
            const isActioning = actioning === item.id;
            return (
              <View key={item.id} style={styles.card}>
                {/* Badge tipo */}
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.text }]}>{BADGE_LABELS[item.type]}</Text>
                </View>

                {/* Rota + horário + preço */}
                <View style={styles.routeRow}>
                  <Text style={styles.routeOrigin} numberOfLines={1}>{shortAddr(item.origin)}</Text>
                  <MaterialIcons name="arrow-forward" size={14} color="#9CA3AF" style={styles.routeArrow} />
                  <Text style={styles.routeDest} numberOfLines={1}>{shortAddr(item.destination)}</Text>
                </View>
                <View style={styles.timeRow}>
                  <Text style={styles.timeLabel}>{item.timeLabel}</Text>
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
                    <View style={styles.userNameRow}>
                      <Text style={styles.userName}>{item.userName}</Text>
                      <Text style={styles.extraLabel}>{item.extraLabel}</Text>
                    </View>
                    <View style={styles.ratingRow}>
                      <MaterialIcons name="star" size={14} color={GOLD} />
                      <Text style={styles.ratingText}>{item.userRating?.toFixed(1) ?? '—'}</Text>
                    </View>
                    <Text style={styles.timeAgo}>Solicitado há {item.minutesAgo} {item.minutesAgo === 1 ? 'minuto' : 'minutos'}</Text>
                  </View>
                </View>

                {/* Botões */}
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={styles.btnRecusar}
                    onPress={() => handleAction(item, false)}
                    disabled={isActioning}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.btnRecusarText}>Recusar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnAceitar, isActioning && { opacity: 0.6 }]}
                    onPress={() => handleAction(item, true)}
                    disabled={isActioning}
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
  scroll: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
  card: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 16,
  },
  badge: {
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, marginBottom: 14,
  },
  badgeText: { fontSize: 13, fontWeight: '600' },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  routeOrigin: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  routeArrow: { marginHorizontal: 6 },
  routeDest: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1, textAlign: 'right' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  timeLabel: { fontSize: 13, color: '#6B7280' },
  price: { fontSize: 15, fontWeight: '700', color: '#111827' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 14 },
  userRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6' },
  avatarPlaceholder: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  userName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  extraLabel: { fontSize: 13, color: '#6B7280' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  ratingText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  timeAgo: { fontSize: 13, color: '#9CA3AF' },
  btnRow: { flexDirection: 'row', gap: 10 },
  btnRecusar: {
    flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  btnRecusarText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
  btnAceitar: {
    flex: 1, backgroundColor: '#111827', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  btnAceitarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
