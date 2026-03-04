import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Text } from '../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ActivitiesStackParamList } from '../navigation/ActivitiesStackTypes';
import { supabase } from '../lib/supabase';
import { StatusBadge, type ActivitySectionBadge } from '../components/StatusBadge';
import { CalendarPicker } from '../components/CalendarPicker';
import { SupportSheet } from '../components/SupportSheet';

type Props = NativeStackScreenProps<ActivitiesStackParamList, 'ActivitiesList'>;

export type ActivityCategory = 'todas' | 'viagens' | 'envios' | 'dependente' | 'excursao';

export type ActivityItem = {
  id: string;
  type: 'viagem' | 'envio' | 'dependente' | 'excursao';
  title: string;
  originAddress?: string;
  dateTime: string;
  priceFormatted: string;
  categoryLabel: string;
  sectionBadge: ActivitySectionBadge;
  bookingStatus?: string;
  created_at: string;
};

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

function formatBookingDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const months = 'Jan Fev Mar Abr Mai Jun Jul Ago Set Out Nov Dez'.split(' ');
  const month = months[d.getMonth()];
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${day} ${month} • ${hours}:${minutes}`;
}

const MONTH_NAMES_FULL = 'janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro'.split(' ');
function formatDatePtBR(d: Date): string {
  return `${d.getDate()} de ${MONTH_NAMES_FULL[d.getMonth()]}`;
}

const ACTIVITIES_FILTER_KEY = 'activities_filter';

type ActivitiesFilterValue = {
  category: ActivityCategory;
  dateStart: string | null;
  dateEnd: string | null;
};

export function ActivitiesScreen({ navigation }: Props) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<ActivityCategory>('todas');
  const [filterDateStart, setFilterDateStart] = useState<Date | null>(null);
  const [filterDateEnd, setFilterDateEnd] = useState<Date | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [supportSheetVisible, setSupportSheetVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const fabBottom = insets.bottom + 24 + 56;

  const loadFilterPreferences = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('user_preferences')
      .select('value')
      .eq('user_id', user.id)
      .eq('key', ACTIVITIES_FILTER_KEY)
      .maybeSingle();
    const v = (data as { value?: ActivitiesFilterValue } | null)?.value;
    if (v?.category) setFilterCategory(v.category as ActivityCategory);
    if (v?.dateStart) setFilterDateStart(new Date(v.dateStart));
    if (v?.dateEnd) setFilterDateEnd(new Date(v.dateEnd));
  }, []);

  const saveFilterPreferences = useCallback(async (category: ActivityCategory, dateStart: Date | null, dateEnd: Date | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_preferences').upsert(
      {
        user_id: user.id,
        key: ACTIVITIES_FILTER_KEY,
        value: {
          category,
          dateStart: dateStart ? dateStart.toISOString() : null,
          dateEnd: dateEnd ? dateEnd.toISOString() : null,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key' }
    );
  }, []);

  const loadActivities = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setActivities([]);
      setLoading(false);
      return;
    }
    const [bookingsRes, shipmentsRes, dependentShipmentsRes, excursionsRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, origin_address, destination_address, amount_cents, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('shipments')
        .select('id, origin_address, destination_address, amount_cents, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('dependent_shipments')
        .select('id, origin_address, destination_address, full_name, amount_cents, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('excursion_requests')
        .select('id, destination, excursion_date, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    const bookingItems: ActivityItem[] = (bookingsRes.data ?? []).map((b) => {
      const s = (b as { status?: string }).status?.toLowerCase() ?? '';
      const sectionBadge: ActivitySectionBadge =
        s === 'paid' || s === 'in_progress' || s === 'confirmed' ? 'confirmada' : 'planejada';
      const dest = (b as { destination_address?: string }).destination_address ?? 'Viagem';
      const origin = (b as { origin_address?: string }).origin_address;
      return {
        id: b.id,
        type: 'viagem',
        title: dest,
        originAddress: origin,
        dateTime: formatBookingDate((b as { created_at: string }).created_at),
        priceFormatted: (b as { amount_cents?: number }).amount_cents != null ? `R$ ${((b as { amount_cents: number }).amount_cents / 100).toFixed(2)}` : 'R$ —',
        categoryLabel: 'Viagem',
        sectionBadge,
        bookingStatus: (b as { status?: string }).status,
        created_at: (b as { created_at: string }).created_at,
      };
    });
    const shipmentItems: ActivityItem[] = (shipmentsRes.data ?? []).map((s) => {
      const status = (s as { status?: string }).status?.toLowerCase() ?? '';
      const sectionBadge: ActivitySectionBadge =
        status === 'confirmed' || status === 'in_progress' || status === 'delivered' ? 'confirmada' : 'planejada';
      const dest = (s as { destination_address?: string }).destination_address ?? 'Envio';
      const origin = (s as { origin_address?: string }).origin_address;
      return {
        id: (s as { id: string }).id,
        type: 'envio',
        title: dest,
        originAddress: origin,
        dateTime: formatBookingDate((s as { created_at: string }).created_at),
        priceFormatted: (s as { amount_cents?: number }).amount_cents != null ? `R$ ${((s as { amount_cents: number }).amount_cents / 100).toFixed(2)}` : 'R$ —',
        categoryLabel: 'Envio',
        sectionBadge,
        created_at: (s as { created_at: string }).created_at,
      };
    });
    const dependentItems: ActivityItem[] = (dependentShipmentsRes.data ?? []).map((d) => {
      const status = (d as { status?: string }).status?.toLowerCase() ?? '';
      const sectionBadge: ActivitySectionBadge =
        status === 'confirmed' || status === 'in_progress' || status === 'delivered' ? 'confirmada' : 'planejada';
      const dest = (d as { destination_address?: string }).destination_address ?? 'Envio dependente';
      const fullName = (d as { full_name?: string }).full_name;
      const title = fullName ? `Envio para ${fullName}` : dest;
      const origin = (d as { origin_address?: string }).origin_address;
      return {
        id: (d as { id: string }).id,
        type: 'dependente',
        title,
        originAddress: origin,
        dateTime: formatBookingDate((d as { created_at: string }).created_at),
        priceFormatted: (d as { amount_cents?: number }).amount_cents != null ? `R$ ${((d as { amount_cents: number }).amount_cents / 100).toFixed(2)}` : 'R$ —',
        categoryLabel: 'Envio dependente',
        sectionBadge,
        created_at: (d as { created_at: string }).created_at,
      };
    });
    const excursionItems: ActivityItem[] = (excursionsRes.data ?? []).map((e) => {
      const status = (e as { status?: string }).status?.toLowerCase() ?? '';
      const sectionBadge: ActivitySectionBadge =
        status === 'contacted' || status === 'quoted' ? 'confirmada' : 'planejada';
      const dest = (e as { destination?: string }).destination ?? 'Excursão';
      const excursionDate = (e as { excursion_date?: string }).excursion_date;
      const createdAt = (e as { created_at: string }).created_at;
      const dateTime = excursionDate
        ? (() => {
            const d = new Date(excursionDate + 'T00:00:00');
            const day = d.getDate();
            const months = 'Jan Fev Mar Abr Mai Jun Jul Ago Set Out Nov Dez'.split(' ');
            const month = months[d.getMonth()];
            return `${day} ${month}`;
          })()
        : formatBookingDate(createdAt);
      return {
        id: (e as { id: string }).id,
        type: 'excursao',
        title: dest ? `Excursão para ${dest}` : 'Excursão',
        dateTime,
        priceFormatted: 'R$ —',
        categoryLabel: 'Excursão',
        sectionBadge,
        created_at: createdAt,
      };
    });
    const combined = [...bookingItems, ...shipmentItems, ...dependentItems, ...excursionItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setActivities(combined);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  useEffect(() => {
    loadFilterPreferences();
  }, [loadFilterPreferences]);

  const filteredActivities = useMemo(() => {
    let list = filterCategory === 'todas'
      ? activities
      : filterCategory === 'viagens'
        ? activities.filter((a) => a.type === 'viagem')
        : filterCategory === 'envios'
          ? activities.filter((a) => a.type === 'envio')
          : activities.filter((a) => a.type === filterCategory);
    if (filterDateStart) {
      const start = filterDateStart.getTime();
      list = list.filter((a) => new Date(a.created_at).getTime() >= start);
    }
    if (filterDateEnd) {
      const end = new Date(filterDateEnd);
      end.setHours(23, 59, 59, 999);
      const endTime = end.getTime();
      list = list.filter((a) => new Date(a.created_at).getTime() <= endTime);
    }
    return list;
  }, [activities, filterCategory, filterDateStart, filterDateEnd]);

  const confirmedActivities = useMemo(
    () => filteredActivities.filter((a) => a.sectionBadge === 'confirmada'),
    [filteredActivities]
  );
  const plannedActivities = useMemo(
    () => filteredActivities.filter((a) => a.sectionBadge === 'planejada'),
    [filteredActivities]
  );

  const openFilter = () => setFilterModalVisible(true);

  const displayId = (item: ActivityItem) =>
    item.type === 'envio'
      ? (item.id.length >= 6 ? `EN${item.id.slice(-6).toUpperCase()}` : item.id)
      : item.type === 'dependente'
        ? (item.id.length >= 6 ? `DP${item.id.slice(-6).toUpperCase()}` : item.id)
        : item.type === 'excursao'
          ? (item.id.length >= 6 ? `EX${item.id.slice(-6).toUpperCase()}` : item.id)
          : (item.id.length >= 6 ? `VG${item.id.slice(-6).toUpperCase()}` : item.id);

  const renderActivityCard = (item: ActivityItem) => {
    const iconName =
      item.type === 'viagem'
        ? 'directions-car'
        : item.type === 'envio'
          ? 'inventory-2'
          : item.type === 'excursao'
            ? 'groups'
            : 'person';
    const routeLabel = item.originAddress
      ? `${item.originAddress} → ${item.title}`
      : item.title;
    const isPlanned = item.sectionBadge === 'planejada';
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.activityRow}
        onPress={() => {
          if (item.type === 'viagem') navigation.navigate('TripDetail', { bookingId: item.id });
          if (item.type === 'envio') navigation.navigate('ShipmentDetail', { shipmentId: item.id });
          if (item.type === 'dependente') {
            // Detalhe do envio de dependente pode ser implementado depois
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.activityIconWrap}>
          <MaterialIcons name={iconName as any} size={24} color={COLORS.neutral700} />
        </View>
        <View style={styles.activityContent}>
          <View style={styles.activityCardHeader}>
            <Text style={styles.activityId}>{displayId(item)}</Text>
            <StatusBadge variant={item.sectionBadge} />
          </View>
          <Text style={styles.activityTitle} numberOfLines={1}>{routeLabel}</Text>
          <Text style={styles.activityDateTime}>{item.dateTime}</Text>
          <Text style={styles.activityPrice}>{item.priceFormatted} • {item.categoryLabel}</Text>
          <Text style={styles.activityLink}>{isPlanned ? 'Editar rota' : 'Ver detalhes'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.suasCorridas}>Suas corridas</Text>
          <TouchableOpacity style={styles.filterButton} onPress={openFilter} activeOpacity={0.8}>
            <MaterialIcons name="tune" size={24} color={COLORS.black} />
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Atividades</Text>
        <TouchableOpacity
          style={styles.historyChip}
          onPress={() => navigation.navigate('TravelHistory')}
          activeOpacity={0.8}
        >
          <MaterialIcons name="access-time" size={20} color={COLORS.black} />
          <Text style={styles.historyChipText}>Histórico de Viagens</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>Carregando...</Text>
        </View>
      ) : filteredActivities.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>Nenhuma atividade ainda</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {confirmedActivities.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, styles.sectionTitleGreen]}>Viagens confirmadas</Text>
              {confirmedActivities.map((item) => renderActivityCard(item))}
            </>
          )}
          {plannedActivities.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, styles.sectionTitleGray]}>Viagens planejadas</Text>
              {plannedActivities.map((item) => renderActivityCard(item))}
            </>
          )}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.fab, { right: 24, bottom: fabBottom }]}
        onPress={() => setSupportSheetVisible(true)}
        activeOpacity={0.8}
      >
        <MaterialIcons name="chat-bubble-outline" size={28} color={COLORS.black} />
      </TouchableOpacity>

      <SupportSheet
        visible={supportSheetVisible}
        onClose={() => setSupportSheetVisible(false)}
        onOpenChat={() => {
          setSupportSheetVisible(false);
          navigation.navigate('Chat', { contactName: 'Suporte Take Me' });
        }}
      />

      {filterModalVisible && (
        <FilterModal
          selectedCategory={filterCategory}
          onSelectCategory={setFilterCategory}
          filterDateStart={filterDateStart}
          filterDateEnd={filterDateEnd}
          onSelectDateStart={setFilterDateStart}
          onSelectDateEnd={setFilterDateEnd}
          onApply={() => {
            setFilterModalVisible(false);
            saveFilterPreferences(filterCategory, filterDateStart, filterDateEnd);
          }}
          onClose={() => setFilterModalVisible(false)}
        />
      )}
    </SafeAreaView>
  );
}

type FilterModalProps = {
  selectedCategory: ActivityCategory;
  onSelectCategory: (c: ActivityCategory) => void;
  filterDateStart: Date | null;
  filterDateEnd: Date | null;
  onSelectDateStart: (d: Date | null) => void;
  onSelectDateEnd: (d: Date | null) => void;
  onApply: () => void;
  onClose: () => void;
};

function FilterModal({
  selectedCategory,
  onSelectCategory,
  filterDateStart,
  filterDateEnd,
  onSelectDateStart,
  onSelectDateEnd,
  onApply,
  onClose,
}: FilterModalProps) {
  const [calendarFor, setCalendarFor] = useState<'start' | 'end' | null>(null);
  const categories: { key: ActivityCategory; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'viagens', label: 'Viagens' },
    { key: 'envios', label: 'Envios' },
    { key: 'dependente', label: 'Dependente' },
    { key: 'excursao', label: 'Excursões' },
  ];
  return (
    <View style={styles.modalOverlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      <View style={styles.modalContent}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.modalTitle}>Filtrar atividades</Text>
          <Text style={styles.modalSectionLabel}>Categoria</Text>
          <View style={styles.chipRow}>
            {categories.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.chip, selectedCategory === key && styles.chipSelected]}
                onPress={() => onSelectCategory(key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, selectedCategory === key && styles.chipTextSelected]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.modalSectionLabel}>Data da atividade</Text>
          <TouchableOpacity
            style={styles.dateField}
            onPress={() => setCalendarFor('start')}
            activeOpacity={0.8}
          >
            <MaterialIcons name="calendar-today" size={20} color={COLORS.neutral700} />
            <Text style={styles.dateFieldText}>
              {filterDateStart ? formatDatePtBR(filterDateStart) : 'Data inicial'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dateField, { marginTop: 8 }]}
            onPress={() => setCalendarFor('end')}
            activeOpacity={0.8}
          >
            <MaterialIcons name="calendar-today" size={20} color={COLORS.neutral700} />
            <Text style={styles.dateFieldText}>
              {filterDateEnd ? formatDatePtBR(filterDateEnd) : 'Data final'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
        <TouchableOpacity style={styles.applyButton} onPress={onApply} activeOpacity={0.8}>
          <Text style={styles.applyButtonText}>Aplicar filtro</Text>
        </TouchableOpacity>
      </View>
      <Modal visible={calendarFor !== null} transparent animationType="fade">
        <View style={styles.calendarModalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setCalendarFor(null)} activeOpacity={1} />
          <View style={styles.calendarModalContent}>
            <CalendarPicker
              initialDate={calendarFor === 'start' ? (filterDateStart ?? new Date()) : (filterDateEnd ?? new Date())}
              selectedDate={calendarFor === 'start' ? filterDateStart : filterDateEnd}
              onSelectDate={(date) => {
                if (calendarFor === 'start') onSelectDateStart(date);
                else onSelectDateEnd(date);
                setCalendarFor(null);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  suasCorridas: { fontSize: 14, color: COLORS.neutral700 },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.black },
  historyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: COLORS.neutral300,
    alignSelf: 'flex-start',
  },
  historyChipText: { fontSize: 14, fontWeight: '600', color: COLORS.black },
  scroll: { flex: 1 },
  listContent: { paddingBottom: 100, paddingHorizontal: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  sectionTitleGreen: { color: '#166534' },
  sectionTitleGray: { color: COLORS.neutral700 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral400,
  },
  activityIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  activityContent: { flex: 1 },
  activityCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  activityId: { fontSize: 15, fontWeight: '700', color: COLORS.black },
  activityTitle: { fontSize: 14, fontWeight: '500', color: COLORS.black },
  activityDateTime: { fontSize: 14, color: COLORS.neutral700, marginTop: 2 },
  activityPrice: { fontSize: 14, color: COLORS.neutral700, marginTop: 2 },
  activityLink: { fontSize: 14, color: COLORS.black, textDecorationLine: 'underline', marginTop: 4 },
  separator: { height: 1, backgroundColor: COLORS.neutral400, marginLeft: 88 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtitle: { fontSize: 15, color: COLORS.neutral700 },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FBBF24',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.black, textAlign: 'center', marginBottom: 24 },
  modalSectionLabel: { fontSize: 16, fontWeight: '600', color: COLORS.black, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.neutral300,
  },
  chipSelected: { backgroundColor: COLORS.black },
  chipText: { fontSize: 14, fontWeight: '500', color: COLORS.black },
  chipTextSelected: { color: '#FFFFFF' },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.neutral300,
  },
  dateFieldText: { fontSize: 15, color: COLORS.black, flex: 1 },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  calendarModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    maxHeight: 420,
  },
  applyButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
