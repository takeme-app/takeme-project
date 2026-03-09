import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { Text } from '../../components/Text';
import { supabase } from '../../lib/supabase';

const COLORS = {
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

export function ConfigureNotificationsContent() {
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
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.black} />
      </View>
    );
  }

  return (
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
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48 },
  section: { marginBottom: 24 },
  sectionTitle: {
    color: COLORS.black,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 24,
    fontStyle: 'normal',
    fontWeight: '600',
    marginBottom: 12,
  },
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
