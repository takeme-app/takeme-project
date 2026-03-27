import { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Text } from '../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { SCREEN_TOP_EXTRA_PADDING } from '../theme/screenLayout';

type Props = NativeStackScreenProps<ProfileStackParamList, 'DataRequest'>;

const GOLD = '#C9A227';

type DriverData = {
  nome: string;
  email: string | null;
  idade: string;
  cpf: string;
  cidade: string;
  subtipo: string;
  rating: string;
  dataCriacao: string;
};

function subtypeLabel(subtype: string | null): string {
  const s = (subtype ?? '').toLowerCase();
  if (s === 'partner') return 'Parceiro TakeMe';
  if (s === 'excursions') return 'Preparador de Excursões';
  if (s === 'shipments') return 'Preparador de Encomendas';
  return 'Motorista TakeMe';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function DataRequestScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DriverData | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name, rating, created_at')
      .eq('id', user.id)
      .maybeSingle();

    const { data: worker } = await supabase
      .from('worker_profiles')
      .select('subtype, cpf, age, city, created_at')
      .eq('id', user.id)
      .maybeSingle();

    const metaName =
      (user.user_metadata?.full_name as string)?.trim() ||
      (user.user_metadata?.name as string)?.trim() || '';

    setData({
      nome: prof?.full_name?.trim() || metaName || user.email?.split('@')[0] || '—',
      email: user.email ?? null,
      idade: worker?.age != null ? `${worker.age} anos` : '—',
      cpf: worker?.cpf?.trim() || '—',
      cidade: worker?.city?.trim() || '—',
      subtipo: subtypeLabel(worker?.subtype ?? null),
      rating: prof?.rating != null ? Number(prof.rating).toFixed(1) : 'Sem avaliações',
      dataCriacao: formatDate(worker?.created_at ?? prof?.created_at ?? ''),
    });
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleExport = async () => {
    if (!data) return;
    setExporting(true);
    const now = new Date().toLocaleDateString('pt-BR');
    const message = [
      `CÓPIA DOS MEUS DADOS — TAKE ME`,
      `Gerado em ${now}`,
      `${'─'.repeat(36)}`,
      ``,
      `Nome:            ${data.nome}`,
      `E-mail:          ${data.email ?? '—'}`,
      `Idade:           ${data.idade}`,
      `CPF:             ${data.cpf}`,
      `Cidade:          ${data.cidade}`,
      `Tipo de conta:   ${data.subtipo}`,
      `Avaliação:       ${data.rating}`,
      `Membro desde:    ${data.dataCriacao}`,
      ``,
      `${'─'.repeat(36)}`,
      `Plataforma: Take Me`,
      `Contato: privacidade@takeme.app.br`,
    ].join('\n');

    try {
      await Share.share({ title: 'Meus dados — Take Me', message });
    } catch { /* cancelado pelo usuário */ }
    setExporting(false);
  };

  const Field = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meus dados</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#111827" /></View>
      ) : !data ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Não foi possível carregar seus dados.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            Confira abaixo os dados cadastrais fornecidos à plataforma Take Me. Você pode exportá-los
            a qualquer momento, conforme previsto na LGPD.
          </Text>

          <View style={styles.card}>
            <Field label="Nome" value={data.nome} />
            <View style={styles.sep} />
            <Field label="E-mail" value={data.email ?? '—'} />
            <View style={styles.sep} />
            <Field label="Idade" value={data.idade} />
            <View style={styles.sep} />
            <Field label="CPF" value={data.cpf} />
            <View style={styles.sep} />
            <Field label="Cidade" value={data.cidade} />
            <View style={styles.sep} />
            <Field label="Tipo de conta" value={data.subtipo} />
            <View style={styles.sep} />
            <Field label="Avaliação" value={data.rating} />
            <View style={styles.sep} />
            <Field label="Membro desde" value={data.dataCriacao} />
          </View>

          <TouchableOpacity
            style={[styles.exportBtn, exporting && { opacity: 0.6 }]}
            onPress={handleExport}
            disabled={exporting}
            activeOpacity={0.85}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.exportBtnInner}>
                <MaterialIcons name="share" size={20} color="#fff" />
                <Text style={styles.exportBtnText}>Exportar cópia dos meus dados</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.legalNote}>
            Solicitações de correção, exclusão ou portabilidade podem ser feitas pelo canal:{' '}
            <Text style={styles.legalEmail}>privacidade@takeme.app.br</Text>
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8 + SCREEN_TOP_EXTRA_PADDING, paddingBottom: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  scroll: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 8 },
  intro: { fontSize: 14, color: '#6B7280', lineHeight: 21, marginBottom: 20 },
  card: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16,
    overflow: 'hidden', marginBottom: 24,
  },
  field: { paddingHorizontal: 16, paddingVertical: 14 },
  fieldLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  fieldValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  sep: { height: 1, backgroundColor: '#F3F4F6' },
  exportBtn: {
    backgroundColor: '#111827', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 20,
  },
  exportBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exportBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  empty: { fontSize: 15, color: '#9CA3AF' },
  legalNote: { fontSize: 13, color: '#9CA3AF', lineHeight: 19, textAlign: 'center' },
  legalEmail: { color: GOLD, fontWeight: '600' },
});
