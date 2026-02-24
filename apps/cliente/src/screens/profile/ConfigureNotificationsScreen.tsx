import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackTypes';
import { supabase } from '../../lib/supabase';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ConfigureNotifications'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral700: '#767676',
};

const PREF_KEYS = [
  { key: 'travel_updates', title: 'Atualizações de viagens', desc: 'Receba alertas sobre o andamento das suas corridas.' },
  { key: 'shipments_deliveries', title: 'Envios e entregas', desc: 'Seja avisado quando seu envio for confirmado ou entregue.' },
  { key: 'excursions_dependents', title: 'Excursões e dependentes', desc: 'Acompanhe atualizações de excursões e viagens de dependentes.' },
  { key: 'payments_pending', title: 'Pagamentos pendentes', desc: 'Receba lembretes sobre cobranças ou faturas em aberto.' },
  { key: 'payment_receipts', title: 'Comprovantes de pagamento', desc: 'Ative o envio automático de recibos e comprovantes.' },
  { key: 'offers_promotions', title: 'Ofertas e promoções', desc: 'Saiba primeiro sobre descontos e campanhas.' },
  { key: 'app_updates', title: 'Atualizações do app', desc: 'Mantenha-se informado sobre novos recursos e melhorias.' },
  { key: 'disable_all', title: 'Desativar todas as notificações', desc: '' },
] as const;

export function ConfigureNotificationsScreen({ navigation }: Props) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('notification_preferences')
        .select('key, enabled')
        .eq('user_id', user.id);
      const map: Record<string, boolean> = {};
      PREF_KEYS.forEach(({ key }) => {
        map[key] = true;
      });
      (data ?? []).forEach((row: { key: string; enabled: boolean }) => {
        map[row.key] = row.enabled;
      });
      setPrefs(map);
      setLoading(false);
    })();
  }, []);

  const setPref = useCallback(async (key: string, enabled: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setPrefs((prev) => ({ ...prev, [key]: enabled }));
    await supabase.from('notification_preferences').upsert(
      { user_id: user.id, key, enabled },
      { onConflict: 'user_id,key' }
    );
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.black} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navbarButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.navbarTitle} numberOfLines={1}>Configurar notificações</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Atividades e status</Text>
          {PREF_KEYS.slice(0, 3).map(({ key, title, desc }) => (
            <View key={key} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{title}</Text>
                {desc ? <Text style={styles.rowDesc}>{desc}</Text> : null}
              </View>
              <Switch
                value={prefs[key] ?? true}
                onValueChange={(v) => setPref(key, v)}
                trackColor={{ false: '#d1d5db', true: COLORS.black }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pagamentos</Text>
          {PREF_KEYS.slice(3, 5).map(({ key, title, desc }) => (
            <View key={key} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{title}</Text>
                {desc ? <Text style={styles.rowDesc}>{desc}</Text> : null}
              </View>
              <Switch
                value={prefs[key] ?? true}
                onValueChange={(v) => setPref(key, v)}
                trackColor={{ false: '#d1d5db', true: COLORS.black }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recomendações e novidades</Text>
          {PREF_KEYS.slice(5, 7).map(({ key, title, desc }) => (
            <View key={key} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{title}</Text>
                {desc ? <Text style={styles.rowDesc}>{desc}</Text> : null}
              </View>
              <Switch
                value={prefs[key] ?? true}
                onValueChange={(v) => setPref(key, v)}
                trackColor={{ false: '#d1d5db', true: COLORS.black }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ações gerais</Text>
          {PREF_KEYS.slice(7, 8).map(({ key, title }) => (
            <View key={key} style={styles.row}>
              <Text style={styles.rowTitle}>{title}</Text>
              <Switch
                value={prefs[key] ?? true}
                onValueChange={(v) => setPref(key, v)}
                trackColor={{ false: '#d1d5db', true: COLORS.black }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navbarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navbarTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.black, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.black, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  rowText: { flex: 1, marginRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: COLORS.black },
  rowDesc: { fontSize: 13, color: COLORS.neutral700, marginTop: 4 },
});
