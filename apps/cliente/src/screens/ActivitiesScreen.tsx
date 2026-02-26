import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ActivitiesStackParamList } from '../navigation/ActivitiesStackTypes';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<ActivitiesStackParamList, 'ActivitiesList'>;

export type ActivityCategory = 'todas' | 'viagens' | 'envios' | 'dependente';

export type ActivityItem = {
  id: string;
  type: 'viagem' | 'envio' | 'dependente' | 'excursao';
  title: string;
  dateTime: string;
  priceFormatted: string;
  categoryLabel: string;
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

export function ActivitiesScreen({ navigation }: Props) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<ActivityCategory>('todas');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const fabBottom = insets.bottom + 24 + 56;

  const loadActivities = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setActivities([]);
      setLoading(false);
      return;
    }
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, destination_address, amount_cents, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    const items: ActivityItem[] = (bookings ?? []).map((b) => ({
      id: b.id,
      type: 'viagem',
      title: b.destination_address ?? 'Viagem',
      dateTime: formatBookingDate(b.created_at),
      priceFormatted: b.amount_cents != null ? `R$ ${(b.amount_cents / 100).toFixed(2)}` : 'R$ —',
      categoryLabel: 'Viagem',
    }));
    setActivities(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const filteredActivities =
    filterCategory === 'todas'
      ? activities
      : filterCategory === 'viagens'
        ? activities.filter((a) => a.type === 'viagem')
        : activities.filter((a) => a.type === filterCategory);

  const openFilter = () => setFilterModalVisible(true);

  const renderItem = ({ item }: { item: ActivityItem }) => {
    const iconName =
      item.type === 'viagem'
        ? 'directions-car'
        : item.type === 'envio'
          ? 'inventory-2'
          : item.type === 'excursao'
            ? 'groups'
            : 'person';
    return (
      <TouchableOpacity
        style={styles.activityRow}
        onPress={() => { if (item.type === 'viagem') navigation.navigate('TripDetail', { bookingId: item.id }); }}
        activeOpacity={0.7}
      >
        <View style={styles.activityIconWrap}>
          <MaterialIcons name={iconName as any} size={24} color={COLORS.neutral700} />
        </View>
        <View style={styles.activityContent}>
          <Text style={styles.activityTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.activityDateTime}>{item.dateTime}</Text>
          <Text style={styles.activityPrice}>{item.priceFormatted} • {item.categoryLabel}</Text>
        </View>
        <Text style={styles.verDetalhes}>Ver detalhes</Text>
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
        <FlatList
          data={filteredActivities}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { right: 24, bottom: fabBottom }]}
        activeOpacity={0.8}
      >
        <MaterialIcons name="chat-bubble-outline" size={28} color={COLORS.black} />
      </TouchableOpacity>

      {filterModalVisible && (
        <FilterModal
          selectedCategory={filterCategory}
          onSelectCategory={setFilterCategory}
          onApply={() => setFilterModalVisible(false)}
          onClose={() => setFilterModalVisible(false)}
        />
      )}
    </SafeAreaView>
  );
}

type FilterModalProps = {
  selectedCategory: ActivityCategory;
  onSelectCategory: (c: ActivityCategory) => void;
  onApply: () => void;
  onClose: () => void;
};

function FilterModal({ selectedCategory, onSelectCategory, onApply, onClose }: FilterModalProps) {
  const categories: { key: ActivityCategory; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'viagens', label: 'Viagens' },
    { key: 'envios', label: 'Envios' },
    { key: 'dependente', label: 'Dependente' },
  ];
  return (
    <View style={styles.modalOverlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      <View style={styles.modalContent}>
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
        <TouchableOpacity style={styles.applyButton} onPress={onApply} activeOpacity={0.8}>
          <Text style={styles.applyButtonText}>Aplicar filtro</Text>
        </TouchableOpacity>
      </View>
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
  listContent: { paddingBottom: 100 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
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
  activityTitle: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  activityDateTime: { fontSize: 14, color: COLORS.neutral700, marginTop: 2 },
  activityPrice: { fontSize: 14, color: COLORS.neutral700, marginTop: 2 },
  verDetalhes: { fontSize: 14, color: COLORS.black, textDecorationLine: 'underline', marginLeft: 8 },
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
  applyButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
