import { useState, useCallback, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Pressable,
} from 'react-native';
import { useBottomSheetDrag } from '../hooks/useBottomSheetDrag';
import { Text } from '../components/Text';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { SCREEN_TOP_EXTRA_PADDING } from '../theme/screenLayout';
import { useAppAlert } from '../contexts/AppAlertContext';

type Props = NativeStackScreenProps<ProfileStackParamList, 'WorkerRoutes'>;

type RouteRow = {
  id: string;
  origin_address: string;
  destination_address: string;
  price_per_person_cents: number;
  is_active: boolean | null;
};

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function shortAddress(full: string): string {
  const parts = full.split(',');
  return parts[0]?.trim() ?? full;
}

export function WorkerRoutesScreen({ navigation }: Props) {
  const { showAlert } = useAppAlert();
  const [rows, setRows] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [price, setPrice] = useState('');
  const [useTakeMe, setUseTakeMe] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) { setRows([]); setLoading(false); return; }
    const { data } = await supabase
      .from('worker_routes')
      .select('id, origin_address, destination_address, price_per_person_cents, is_active')
      .eq('worker_id', user.id)
      .order('created_at', { ascending: true });
    setRows((data ?? []) as RouteRow[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openModal = () => {
    setOrigin(''); setDestination(''); setPrice(''); setUseTakeMe(false);
    resetDrag();
    slideAnim.setValue(300);
    setModalVisible(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  };

  const closeModal = () => {
    Animated.timing(slideAnim, { toValue: 300, duration: 250, useNativeDriver: true }).start(() => setModalVisible(false));
  };

  const { dragY, panHandlers, resetDrag } = useBottomSheetDrag(closeModal);

  const handleSave = async () => {
    if (useTakeMe) {
      // Load TakeMe routes and copy to worker_routes
      setSaving(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) throw new Error('Não autenticado.');
        const { data: tmRoutes } = await supabase
          .from('takeme_routes')
          .select('origin_address, destination_address, price_per_person_cents')
          .eq('is_active', true);
        if (!tmRoutes?.length) {
          showAlert('Aviso', 'Nenhuma rota TakeMe disponível no momento.');
          setSaving(false);
          return;
        }
        const inserts = tmRoutes.map((r) => ({
          worker_id: user.id,
          origin_address: r.origin_address,
          destination_address: r.destination_address,
          price_per_person_cents: r.price_per_person_cents,
          is_active: true,
        }));
        const { error } = await supabase.from('worker_routes').insert(inserts);
        if (error) throw error;
        closeModal();
        await load();
      } catch (e) {
        showAlert('Erro', (e as { message?: string })?.message ?? 'Erro ao importar rotas.');
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!origin.trim()) { showAlert('Atenção', 'Informe a origem.'); return; }
    if (!destination.trim()) { showAlert('Atenção', 'Informe o destino.'); return; }
    const priceCents = Math.round(parseFloat(price.replace(',', '.')) * 100);
    if (!priceCents || priceCents <= 0) { showAlert('Atenção', 'Informe um valor válido.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Não autenticado.');
      const { error } = await supabase.from('worker_routes').insert({
        worker_id: user.id,
        origin_address: origin.trim(),
        destination_address: destination.trim(),
        price_per_person_cents: priceCents,
        is_active: true,
      });
      if (error) throw error;
      closeModal();
      await load();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Erro ao salvar rota.';
      showAlert('Erro', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Minhas rotas</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#111827" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {rows.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.card}
              onPress={() => navigation.navigate('RouteSchedule', {
                routeId: r.id,
                routeName: `${shortAddress(r.origin_address)} → ${shortAddress(r.destination_address)}`,
              })}
              activeOpacity={0.75}
            >
              <View style={styles.cardInner}>
                <View style={styles.cardText}>
                  <Text style={styles.cardRoute}>
                    {shortAddress(r.origin_address)}
                    <Text style={styles.arrow}> → </Text>
                    {shortAddress(r.destination_address)}
                  </Text>
                  <Text style={styles.cardPrice}>{formatCents(r.price_per_person_cents)} por pessoa</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.addLink} onPress={openModal} activeOpacity={0.7}>
            <Text style={styles.addLinkText}>Adicionar nova rota</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeModal} />
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY: Animated.add(slideAnim, dragY) }] }]}
          >
            <View style={styles.handleArea} {...panHandlers}>
              <View style={styles.sheetHandle} />
            </View>
            <View style={styles.sheetHeader}>
              <TouchableOpacity style={styles.iconBtn} onPress={closeModal} activeOpacity={0.7}>
                <MaterialIcons name="close" size={20} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Adicionar nova rota</Text>
              <View style={styles.iconBtn} />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Origem</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Rua Haddock Lobo, 1302"
                placeholderTextColor="#9CA3AF"
                value={origin}
                onChangeText={setOrigin}
              />

              <Text style={styles.fieldLabel}>Destino</Text>
              <TextInput
                style={styles.input}
                placeholder="Av. Paulista, 500"
                placeholderTextColor="#9CA3AF"
                value={destination}
                onChangeText={setDestination}
              />

              <Text style={styles.fieldLabel}>Valor por pessoa</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: R$ 25,00"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
              <Text style={styles.fieldHint}>Valor cobrado por pessoa</Text>

              <View style={styles.toggleRow}>
                <View style={styles.toggleText}>
                  <Text style={styles.toggleLabel}>Usar rotas cadastradas pela Take Me</Text>
                  <Text style={styles.toggleSub}>
                    Importar as rotas padrão da TakeMe para sua lista. Você poderá editar depois.
                  </Text>
                </View>
                <Switch
                  value={useTakeMe}
                  onValueChange={setUseTakeMe}
                  trackColor={{ false: '#E5E7EB', true: '#111827' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.saveBtnText}>Salvar rota</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal} disabled={saving} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>Voltar sem salvar</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8 + SCREEN_TOP_EXTRA_PADDING,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },
  card: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 18, marginBottom: 12,
  },
  cardInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardText: { flex: 1 },
  cardRoute: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  arrow: { color: '#C9A227', fontWeight: '700' },
  cardPrice: { fontSize: 14, color: '#6B7280' },
  addLink: { alignSelf: 'center', paddingVertical: 8, marginTop: 8 },
  addLinkText: { fontSize: 15, color: '#111827', textDecorationLine: 'underline', fontWeight: '500' },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingBottom: 36, maxHeight: '90%',
  },
  handleArea: { paddingTop: 14, paddingBottom: 10, alignItems: 'center' },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB',
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 16, marginBottom: 8 },
  fieldHint: { fontSize: 12, color: '#9CA3AF', marginTop: 4, marginBottom: 4 },
  input: {
    backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827',
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginTop: 20, marginBottom: 8, gap: 12,
  },
  toggleText: { flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 4 },
  toggleSub: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  saveBtn: {
    backgroundColor: '#111827', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 24,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  cancelBtnText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
});
