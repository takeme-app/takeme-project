import { useState, useCallback, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
  Modal,
  TextInput,
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
import {
  latLngFromDbColumns,
  DEFAULT_MAP_REGION_BR,
} from '../components/googleMaps';

type Props = NativeStackScreenProps<ProfileStackParamList, 'RouteSchedule'>;

const GOLD = '#C9A227';
const DAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
const DAY_SHORT_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
// day_of_week: 1=Mon ... 6=Sat, 0=Sun

type TripRow = {
  id: string;
  day_of_week: number;
  departure_time: string | null;
  arrival_time: string | null;
  capacity: number;
  confirmed_count: number;
  price_per_person_cents: number;
  is_active: boolean;
};

type DayToggle = Record<number, boolean>;

type PriceAdjust = {
  weekend: string;
  nocturnal: string;
  holiday: string;
};

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Coordenadas para `scheduled_trips` (colunas NOT NULL): copia de `worker_routes` quando válidas;
 * senão fallback no Brasil (nunca 0,0 — evita mapa no Atlântico).
 */
function coordsForScheduledTripFromRoute(row: {
  origin_lat?: number | null;
  origin_lng?: number | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
}): {
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
} {
  const o = latLngFromDbColumns(row.origin_lat, row.origin_lng);
  const d = latLngFromDbColumns(row.destination_lat, row.destination_lng);
  if (o && d) {
    return {
      origin_lat: o.latitude,
      origin_lng: o.longitude,
      destination_lat: d.latitude,
      destination_lng: d.longitude,
    };
  }
  if (o && !d) {
    return {
      origin_lat: o.latitude,
      origin_lng: o.longitude,
      destination_lat: o.latitude + 0.04,
      destination_lng: o.longitude + 0.04,
    };
  }
  if (!o && d) {
    return {
      origin_lat: d.latitude - 0.04,
      origin_lng: d.longitude - 0.04,
      destination_lat: d.latitude,
      destination_lng: d.longitude,
    };
  }
  const c = DEFAULT_MAP_REGION_BR;
  return {
    origin_lat: c.latitude,
    origin_lng: c.longitude,
    destination_lat: c.latitude + 0.05,
    destination_lng: c.longitude + 0.05,
  };
}

function totalValue(base: number, count: number, adjust: PriceAdjust, dayIdx: number): number {
  const isWeekend = dayIdx === 5 || dayIdx === 6;
  let total = base * count;
  if (isWeekend) {
    const pct = parseFloat(adjust.weekend) || 0;
    total = total * (1 + pct / 100);
  }
  return total;
}

export function RouteScheduleScreen({ navigation, route }: Props) {
  const { routeId, routeName } = route.params;
  const { showAlert } = useAppAlert();
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayToggles, setDayToggles] = useState<DayToggle>({});
  const [priceAdjust, setPriceAdjust] = useState<PriceAdjust>({ weekend: '15', nocturnal: '15', holiday: '15' });
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [addingDayIdx, setAddingDayIdx] = useState(0);
  const [newDepart, setNewDepart] = useState('');
  const [newArrive, setNewArrive] = useState('');
  const [newCapacity, setNewCapacity] = useState('4');
  const [addSaving, setAddSaving] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;

  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferTripId, setTransferTripId] = useState<string | null>(null);
  const [transferTargetDay, setTransferTargetDay] = useState(0);
  const [transferSaving, setTransferSaving] = useState(false);
  const transferSlideAnim = useRef(new Animated.Value(400)).current;

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('scheduled_trips')
      .select('id, day_of_week, departure_time, arrival_time, capacity, confirmed_count, price_per_person_cents, is_active')
      .eq('route_id', routeId)
      .order('day_of_week', { ascending: true });

    const rows = (data ?? []) as TripRow[];
    setTrips(rows);
    const toggles: DayToggle = {};
    for (const t of rows) {
      const idx = t.day_of_week === 0 ? 6 : t.day_of_week - 1;
      if (toggles[idx] === undefined) toggles[idx] = t.is_active;
    }
    setDayToggles(toggles);
    setLoading(false);
  }, [routeId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const dayTrips = (dayIdx: number) =>
    trips.filter((t) => {
      const idx = t.day_of_week === 0 ? 6 : t.day_of_week - 1;
      return idx === dayIdx;
    });

  const toggleDay = async (dayIdx: number, value: boolean) => {
    setDayToggles((p) => ({ ...p, [dayIdx]: value }));
    const dayNum = dayIdx === 6 ? 0 : dayIdx + 1;
    await supabase
      .from('scheduled_trips')
      .update({ is_active: value } as never)
      .eq('route_id', routeId)
      .eq('day_of_week', dayNum);
  };

  const openAddModal = (dayIdx: number) => {
    setAddingDayIdx(dayIdx);
    setNewDepart(''); setNewArrive(''); setNewCapacity('4');
    resetDrag();
    slideAnim.setValue(400);
    setModalVisible(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  };

  const closeModal = () => {
    Animated.timing(slideAnim, { toValue: 400, duration: 250, useNativeDriver: true })
      .start(() => setModalVisible(false));
  };

  const { dragY, panHandlers, resetDrag } = useBottomSheetDrag(closeModal);

  const closeTransferModal = () => {
    Animated.timing(transferSlideAnim, { toValue: 400, duration: 250, useNativeDriver: true })
      .start(() => setTransferModalVisible(false));
  };

  const { dragY: transferDragY, panHandlers: transferPanHandlers, resetDrag: resetTransferDrag } = useBottomSheetDrag(closeTransferModal);

  const handleTransfer = async () => {
    if (!transferTripId || transferTargetDay === null) return;
    setTransferSaving(true);
    try {
      const dayNum = transferTargetDay === 6 ? 0 : transferTargetDay + 1;
      await supabase.from('scheduled_trips')
        .update({ day_of_week: dayNum, updated_at: new Date().toISOString() } as never)
        .eq('id', transferTripId);
      closeTransferModal();
      await load();
    } catch (e) {
      showAlert('Erro', 'Não foi possível transferir a viagem.');
    } finally {
      setTransferSaving(false);
    }
  };

  const handleAddTrip = async () => {
    if (!newDepart.match(/^\d{1,2}:\d{2}$/)) { showAlert('Atenção', 'Informe horário de saída (ex: 06:00).'); return; }
    if (!newArrive.match(/^\d{1,2}:\d{2}$/)) { showAlert('Atenção', 'Informe horário de chegada (ex: 08:30).'); return; }
    const cap = parseInt(newCapacity, 10);
    if (!cap || cap < 1) { showAlert('Atenção', 'Capacidade inválida.'); return; }
    setAddSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Não autenticado.');

      const { data: routeData, error: routeErr } = await supabase
        .from('worker_routes')
        .select(
          'origin_address, destination_address, price_per_person_cents, origin_lat, origin_lng, destination_lat, destination_lng',
        )
        .eq('id', routeId)
        .single();
      if (routeErr || !routeData) throw new Error('Não foi possível carregar os dados da rota.');

      const r = routeData as {
        origin_address: string;
        destination_address: string;
        price_per_person_cents: number;
        origin_lat?: number | null;
        origin_lng?: number | null;
        destination_lat?: number | null;
        destination_lng?: number | null;
      };

      const geo = coordsForScheduledTripFromRoute(r);

      // dayNum: 0=Dom, 1=Seg … 6=Sáb (mesmo que JS Date.getDay())
      const dayNum = addingDayIdx === 6 ? 0 : addingDayIdx + 1;

      // Calcular departure_at e arrival_at para a próxima ocorrência desse dia da semana
      const [depH, depM] = newDepart.split(':').map(Number);
      const [arrH, arrM] = newArrive.split(':').map(Number);
      const todayDay = new Date().getDay();
      let daysAhead = (dayNum - todayDay + 7) % 7;
      if (daysAhead === 0) daysAhead = 7; // sempre futura (próxima semana se hoje for o mesmo dia)

      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + daysAhead);
      baseDate.setHours(0, 0, 0, 0);

      const departureAt = new Date(baseDate);
      departureAt.setHours(depH, depM, 0, 0);

      const arrivalAt = new Date(baseDate);
      arrivalAt.setHours(arrH, arrM, 0, 0);
      if (arrivalAt <= departureAt) arrivalAt.setDate(arrivalAt.getDate() + 1); // virada de meia-noite

      const { error } = await supabase.from('scheduled_trips').insert({
        driver_id: user.id,
        route_id: routeId,
        day_of_week: dayNum,
        departure_time: newDepart,
        arrival_time: newArrive,
        departure_at: departureAt.toISOString(),
        arrival_at: arrivalAt.toISOString(),
        capacity: cap,
        seats_available: cap,
        bags_available: 0,
        confirmed_count: 0,
        is_active: true,
        status: 'scheduled',
        origin_address: r.origin_address,
        destination_address: r.destination_address,
        price_per_person_cents: r.price_per_person_cents,
        origin_lat: geo.origin_lat,
        origin_lng: geo.origin_lng,
        destination_lat: geo.destination_lat,
        destination_lng: geo.destination_lng,
      });
      if (error) throw error;
      closeModal();
      await load();
    } catch (e: unknown) {
      showAlert('Erro', (e as { message?: string })?.message ?? 'Erro ao adicionar viagem.');
    } finally {
      setAddSaving(false);
    }
  };

  const saveAdjustments = async () => {
    setSavingAdjust(true);
    await supabase
      .from('worker_routes')
      .update({
        weekend_surcharge_pct: parseFloat(priceAdjust.weekend) || 0,
        nocturnal_surcharge_pct: parseFloat(priceAdjust.nocturnal) || 0,
        holiday_surcharge_pct: parseFloat(priceAdjust.holiday) || 0,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', routeId);
    setSavingAdjust(false);
    showAlert('Ajustes', 'Ajustes salvos com sucesso.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="close" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cronograma da rota</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#111827" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Roteiro da semana atual</Text>

          {DAYS.map((day, idx) => {
            const dTrips = dayTrips(idx);
            const enabled = dayToggles[idx] ?? false;

            return (
              <View key={day} style={[styles.dayCard, !enabled && styles.dayCardDisabled]}>
                <View style={styles.dayHeader}>
                  <View>
                    <Text style={styles.dayName}>{day}</Text>
                    <Text style={styles.dayCount}>{dTrips.length} {dTrips.length === 1 ? 'viagem' : 'viagens'}</Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={(v) => toggleDay(idx, v)}
                    trackColor={{ false: '#E5E7EB', true: '#111827' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {dTrips.map((t) => {
                  const total = totalValue(t.price_per_person_cents, t.confirmed_count, priceAdjust, idx);
                  return (
                    <View key={t.id} style={styles.tripCard}>
                      <View style={styles.tripRoute}>
                        <Text style={styles.tripRouteText}>{routeName}</Text>
                      </View>
                      <View style={styles.tripTimes}>
                        <Text style={styles.tripTime}>{t.departure_time?.slice(0, 5) ?? '—'}</Text>
                        <MaterialIcons name="arrow-forward" size={14} color="#9CA3AF" />
                        <Text style={styles.tripTime}>{t.arrival_time?.slice(0, 5) ?? '—'}</Text>
                      </View>
                      <Text style={styles.tripSeats}>{t.capacity} lugares</Text>
                      <Text style={styles.tripConfirmed}>{t.confirmed_count} passageiros confirmados</Text>
                      <View style={styles.tripPriceRow}>
                        <Text style={styles.tripPriceLabel}>Valor por pessoa</Text>
                        <Text style={styles.tripPriceValue}>{formatCents(t.price_per_person_cents)}</Text>
                      </View>
                      <View style={styles.tripPriceRow}>
                        <Text style={styles.tripPriceLabel}>Valor total da viagem</Text>
                        <Text style={[styles.tripPriceValue, { color: GOLD }]}>{formatCents(total)}</Text>
                      </View>
                      <TouchableOpacity style={styles.actionRow} onPress={() => {
                        setTransferTripId(t.id);
                        setTransferTargetDay(idx);
                        resetTransferDrag();
                        transferSlideAnim.setValue(400);
                        setTransferModalVisible(true);
                        Animated.spring(transferSlideAnim, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
                      }} activeOpacity={0.7}>
                        <MaterialIcons name="swap-horiz" size={18} color="#111827" />
                        <Text style={styles.actionLabel}>Transferir viagem</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}

                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => openAddModal(idx)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="add" size={18} color="#111827" />
                  <Text style={styles.actionLabel}>Adicionar viagem</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Ajustes de preços */}
          <Text style={styles.adjustTitle}>Ajustes de preços desta semana</Text>

          {[
            { label: 'Adicional fim de semana (%)', key: 'weekend', base: 150 },
            { label: 'Adicional noturno (%)', key: 'nocturnal', base: 125 },
            { label: 'Adicional feriado (%)', key: 'holiday', base: 125 },
          ].map((item) => (
            <View key={item.key} style={styles.adjustGroup}>
              <Text style={styles.adjustLabel}>{item.label}</Text>
              <TextInput
                style={styles.adjustInput}
                value={priceAdjust[item.key as keyof PriceAdjust]}
                onChangeText={(v) => setPriceAdjust((p) => ({ ...p, [item.key]: v.replace(/[^0-9.]/g, '') }))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.adjustHint}>
                Valor da viagem + adicional{'  '}
                <Text style={styles.adjustHintValue}>
                  R$ {item.base},00
                </Text>
              </Text>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.saveAdjBtn, savingAdjust && { opacity: 0.6 }]}
            onPress={saveAdjustments}
            disabled={savingAdjust}
            activeOpacity={0.85}
          >
            {savingAdjust
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.saveAdjBtnText}>Salvar ajustes</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => setPriceAdjust({ weekend: '', nocturnal: '', holiday: '' })}
            activeOpacity={0.7}
          >
            <Text style={styles.clearBtnText}>Limpar campos</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Transferir viagem modal */}
      <Modal visible={transferModalVisible} transparent animationType="none" onRequestClose={closeTransferModal}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeTransferModal} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: Animated.add(transferSlideAnim, transferDragY) }] }]}>
            <View style={styles.handleArea} {...transferPanHandlers}>
              <View style={styles.sheetHandle} />
            </View>
            <View style={styles.sheetTopRow}>
              <Text style={styles.sheetTitle}>Transferir viagem</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={closeTransferModal} activeOpacity={0.7}>
                <MaterialIcons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>
            <View style={styles.sheetDivider} />
            <Text style={styles.fieldLabel}>Escolha o novo dia da semana para esta viagem.</Text>
            <View style={styles.dayChipsRow}>
              {DAY_SHORT_LABELS.map((label, i) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.dayChip, transferTargetDay === i && styles.dayChipSelected]}
                  onPress={() => setTransferTargetDay(i)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayChipText, transferTargetDay === i && styles.dayChipTextSelected]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.addBtn, transferSaving && { opacity: 0.6 }]}
              onPress={handleTransfer}
              disabled={transferSaving}
              activeOpacity={0.85}
            >
              {transferSaving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.addBtnText}>Confirmar transferência</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.transferCancelBtn} onPress={closeTransferModal} disabled={transferSaving} activeOpacity={0.7}>
              <Text style={styles.transferCancelText}>Voltar</Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Nova viagem modal */}
      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeModal} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: Animated.add(slideAnim, dragY) }] }]}>
            <View style={styles.handleArea} {...panHandlers}>
              <View style={styles.sheetHandle} />
            </View>
            <View style={styles.sheetTopRow}>
              <Text style={styles.sheetTitle}>Nova viagem</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={closeModal} activeOpacity={0.7}>
                <MaterialIcons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>
            <View style={styles.sheetDivider} />

            <Text style={styles.fieldLabel}>Horário de saída</Text>
            <TextInput
              style={styles.input}
              placeholder="00:00"
              placeholderTextColor="#9CA3AF"
              value={newDepart}
              onChangeText={(v) => {
                const digits = v.replace(/\D/g, '').slice(0, 4);
                if (digits.length <= 2) {
                  setNewDepart(digits);
                } else {
                  setNewDepart(digits.slice(0, 2) + ':' + digits.slice(2));
                }
              }}
              keyboardType="numeric"
              maxLength={5}
            />

            <Text style={styles.fieldLabel}>Horário de chegada</Text>
            <TextInput
              style={styles.input}
              placeholder="00:00"
              placeholderTextColor="#9CA3AF"
              value={newArrive}
              onChangeText={(v) => {
                const digits = v.replace(/\D/g, '').slice(0, 4);
                if (digits.length <= 2) {
                  setNewArrive(digits);
                } else {
                  setNewArrive(digits.slice(0, 2) + ':' + digits.slice(2));
                }
              }}
              keyboardType="numeric"
              maxLength={5}
            />

            <Text style={styles.fieldLabel}>Capacidade</Text>
            <TextInput
              style={styles.input}
              placeholder="4"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              maxLength={2}
              value={newCapacity}
              onChangeText={(v) => setNewCapacity(v.replace(/\D/g, ''))}
            />

            <TouchableOpacity
              style={[styles.addBtn, addSaving && { opacity: 0.6 }]}
              onPress={handleAddTrip}
              disabled={addSaving}
              activeOpacity={0.85}
            >
              {addSaving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.addBtnText}>Adicionar</Text>
              }
            </TouchableOpacity>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8 + SCREEN_TOP_EXTRA_PADDING, paddingBottom: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  scroll: { paddingHorizontal: 16, paddingBottom: 48 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginVertical: 16 },
  dayCard: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16,
    padding: 16, marginBottom: 12,
  },
  dayCardDisabled: { opacity: 0.6 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dayName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  dayCount: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  tripCard: {
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 10,
  },
  tripRoute: { marginBottom: 4 },
  tripRouteText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  tripTimes: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  tripTime: { fontSize: 13, fontWeight: '500', color: '#374151' },
  tripSeats: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  tripConfirmed: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  tripPriceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  tripPriceLabel: { fontSize: 13, color: '#6B7280' },
  tripPriceValue: { fontSize: 13, fontWeight: '600', color: '#111827' },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  actionLabel: { fontSize: 14, color: '#111827', fontWeight: '500' },
  adjustTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 24, marginBottom: 16 },
  adjustGroup: { marginBottom: 16 },
  adjustLabel: { fontSize: 14, color: '#6B7280', marginBottom: 6 },
  adjustInput: {
    backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827', marginBottom: 4,
  },
  adjustHint: { fontSize: 12, color: '#9CA3AF' },
  adjustHintValue: { fontWeight: '600', color: '#374151' },
  saveAdjBtn: {
    backgroundColor: '#111827', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  saveAdjBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  clearBtn: { alignItems: 'center', paddingVertical: 14 },
  clearBtnText: { color: '#6B7280', fontSize: 15, fontWeight: '500' },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  handleArea: { paddingTop: 14, paddingBottom: 6, alignItems: 'center', marginBottom: -6 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' },
  sheetTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  sheetDivider: { height: 1, backgroundColor: '#E5E7EB', marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 12, marginBottom: 8 },
  input: {
    backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827',
  },
  addBtn: {
    backgroundColor: '#111827', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 24,
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dayChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 4 },
  dayChip: {
    backgroundColor: '#F3F4F6', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  dayChipSelected: { backgroundColor: '#111827' },
  dayChipText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  dayChipTextSelected: { color: '#FFFFFF' },
  transferCancelBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  transferCancelText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
});
