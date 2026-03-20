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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { SCREEN_TOP_EXTRA_PADDING } from '../theme/screenLayout';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Notifications'>;

const GOLD = '#C9A227';

type NotifRow = {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

type Tab = 'list' | 'config';

type PrefGroup = {
  title: string;
  items: { key: string; label: string; sub: string }[];
};

const PREF_GROUPS: PrefGroup[] = [
  {
    title: 'Atividades e status',
    items: [
      { key: 'trip_updates', label: 'Atualizações de viagens', sub: 'Receba alertas sobre o andamento das suas corridas.' },
      { key: 'deliveries', label: 'Envios e entregas', sub: 'Seja avisado quando seu envio for confirmado ou entregue.' },
      { key: 'excursions', label: 'Excursões e dependentes', sub: 'Acompanhe atualizações de excursões e viagens de dependentes.' },
    ],
  },
  {
    title: 'Pagamentos',
    items: [
      { key: 'pending_payments', label: 'Pagamentos pendentes', sub: 'Receba lembretes sobre cobranças ou faturas em aberto.' },
      { key: 'receipts', label: 'Comprovantes de pagamento', sub: 'Ative o envio automático de recibos e comprovantes.' },
    ],
  },
  {
    title: 'Recomendações e novidades',
    items: [
      { key: 'offers', label: 'Ofertas e promoções', sub: 'Saiba primeiro sobre descontos e campanhas.' },
      { key: 'app_updates', label: 'Atualizações do app', sub: 'Mantenha-se informado sobre novos recursos e melhorias.' },
    ],
  },
  {
    title: 'Ações gerais',
    items: [
      { key: 'disable_all', label: 'Desativar todas as notificações', sub: '' },
    ],
  },
];

const DEFAULT_PREFS: Record<string, boolean> = {
  trip_updates: true,
  deliveries: false,
  excursions: false,
  pending_payments: true,
  receipts: false,
  offers: true,
  app_updates: false,
  disable_all: false,
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' • ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function NotificationsScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('list');
  const [notifications, setNotifications] = useState<NotifRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(DEFAULT_PREFS);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { data } = await supabase
        .from('notifications')
        .select('id, title, body, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications((data ?? []) as NotifRow[]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true } as never).eq('id', id);
  };

  const togglePref = (key: string, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificações</Text>
        <View style={styles.iconBtn} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setTab('list')} activeOpacity={0.7}>
          <Text style={[styles.tabLabel, tab === 'list' && styles.tabLabelActive]}>Notificações</Text>
          {tab === 'list' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setTab('config')} activeOpacity={0.7}>
          <Text style={[styles.tabLabel, tab === 'config' && styles.tabLabelActive]}>Configurar notificações</Text>
          {tab === 'config' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      </View>

      {tab === 'list' ? (
        loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#111827" /></View>
        ) : notifications.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Nenhuma notificação ainda.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {notifications.map((n, i) => (
              <TouchableOpacity
                key={n.id}
                style={styles.notifRow}
                onPress={() => markRead(n.id)}
                activeOpacity={0.7}
              >
                {!n.is_read && <View style={styles.unreadDot} />}
                <View style={[styles.bellCircle, { backgroundColor: n.is_read ? '#F3F4F6' : '#FEF3C7' }]}>
                  <MaterialIcons name="notifications-none" size={22} color={n.is_read ? '#9CA3AF' : GOLD} />
                </View>
                <View style={styles.notifContent}>
                  <Text style={[styles.notifTitle, !n.is_read && styles.notifTitleBold]}>{n.title}</Text>
                  <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
                  <Text style={styles.notifDate}>{formatDate(n.created_at)}</Text>
                </View>
                {i < notifications.length - 1 && <View style={styles.notifSep} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )
      ) : (
        <ScrollView contentContainerStyle={styles.configScroll} showsVerticalScrollIndicator={false}>
          {PREF_GROUPS.map((group) => (
            <View key={group.title} style={styles.prefGroup}>
              <Text style={styles.prefGroupTitle}>{group.title}</Text>
              {group.items.map((item, i) => (
                <View key={item.key}>
                  <View style={styles.prefRow}>
                    <View style={styles.prefText}>
                      <Text style={styles.prefLabel}>{item.label}</Text>
                      {item.sub ? <Text style={styles.prefSub}>{item.sub}</Text> : null}
                    </View>
                    <Switch
                      value={prefs[item.key] ?? false}
                      onValueChange={(v) => togglePref(item.key, v)}
                      trackColor={{ false: '#E5E7EB', true: '#111827' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                  {i < group.items.length - 1 && <View style={styles.prefSep} />}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#9CA3AF', fontSize: 15 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8 + SCREEN_TOP_EXTRA_PADDING, paddingBottom: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tabItem: { flex: 1, alignItems: 'center', paddingBottom: 10, paddingTop: 4, position: 'relative' },
  tabLabel: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
  tabLabelActive: { color: '#111827', fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 16, right: 16, height: 2, backgroundColor: '#111827', borderRadius: 1 },
  notifRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 16, gap: 14,
  },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: GOLD,
    marginTop: 18, marginLeft: -4, marginRight: -10,
  },
  bellCircle: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
  },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 15, fontWeight: '500', color: '#111827', marginBottom: 4 },
  notifTitleBold: { fontWeight: '700' },
  notifBody: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 6 },
  notifDate: { fontSize: 12, color: '#9CA3AF' },
  notifSep: { position: 'absolute', bottom: 0, left: 78, right: 20, height: 1, backgroundColor: '#F3F4F6' },
  configScroll: { paddingHorizontal: 20, paddingBottom: 40 },
  prefGroup: { marginTop: 28 },
  prefGroupTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 16 },
  prefRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, gap: 16,
  },
  prefText: { flex: 1 },
  prefLabel: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  prefSub: { fontSize: 13, color: '#6B7280', lineHeight: 17 },
  prefSep: { height: 1, backgroundColor: '#F3F4F6' },
});
