import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Image,
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
import { normalizeVehiclePhotosUrls, resolveVehiclePhotoUri } from '../utils/storageUrl';

type Props = NativeStackScreenProps<ProfileStackParamList, 'WorkerVehicles'>;

type VehicleRow = {
  id: string;
  model: string;
  plate: string;
  year: number;
  passenger_capacity: number;
  use_type: string | null;
  vehicle_photos_urls: string[] | null;
  coverSignedUri: string | null;
};

const GOLD = '#C9A227';

export function WorkerVehiclesScreen({ navigation, route }: Props) {
  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  const showToast = useCallback(
    (msg: string) => {
      setToast(msg);
      Animated.sequence([
        Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(2200),
        Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setToast(null));
    },
    [toastAnim],
  );

  useEffect(() => {
    const msg = route.params?.successMessage;
    if (msg) {
      const t = setTimeout(() => showToast(msg), 100);
      navigation.setParams({ successMessage: undefined });
      return () => clearTimeout(t);
    }
  }, [route.params?.successMessage, showToast, navigation]);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('vehicles')
      .select('id, model, plate, year, passenger_capacity, use_type, vehicle_photos_urls')
      .eq('worker_id', user.id)
      .order('created_at', { ascending: true });
    const raw = (data ?? []) as Omit<VehicleRow, 'coverSignedUri'>[];
    const enriched: VehicleRow[] = await Promise.all(
      raw.map(async (row) => {
        const first = normalizeVehiclePhotosUrls(row.vehicle_photos_urls)[0] ?? null;
        const coverSignedUri = first ? await resolveVehiclePhotoUri(first) : null;
        return { ...row, coverSignedUri };
      }),
    );
    setRows(enriched);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {toast ? (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <MaterialIcons name="check-circle" size={20} color="#fff" />
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meus veículos</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {rows.map((v) => {
            const isPrincipal = (v.use_type ?? 'principal') === 'principal';
            return (
              <TouchableOpacity
                key={v.id}
                style={styles.card}
                onPress={() => navigation.navigate('VehicleDetail', { vehicleId: v.id })}
                activeOpacity={0.85}
              >
                <View style={styles.cardPhotoArea}>
                  {v.coverSignedUri ? (
                    <Image source={{ uri: v.coverSignedUri }} style={styles.cardPhoto} resizeMode="cover" />
                  ) : null}
                </View>
                <View style={styles.cardBadgeRow}>
                  <View style={[styles.badge, isPrincipal ? styles.badgePrincipal : styles.badgeReserva]}>
                    <Text style={[styles.badgeText, isPrincipal ? styles.badgeTextPrincipal : styles.badgeTextReserva]}>
                      {isPrincipal ? 'Principal' : 'Reserva'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardModel}>
                  {v.model} {v.year}
                </Text>
                <Text style={styles.cardMeta}>{v.plate}</Text>
                <Text style={styles.cardMeta}>{v.passenger_capacity} passageiros</Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={styles.addLink}
            onPress={() => navigation.navigate('VehicleForm', {})}
            activeOpacity={0.7}
          >
            <Text style={styles.addLinkText}>Adicionar novo veículo</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  toast: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 10,
  },
  toastText: { color: '#fff', fontSize: 15, fontWeight: '500', flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8 + SCREEN_TOP_EXTRA_PADDING,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4 },
  card: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  cardPhotoArea: { height: 100, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  cardPhoto: { width: '100%', height: '100%' },
  cardBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  badgePrincipal: { backgroundColor: GOLD },
  badgeReserva: { backgroundColor: '#E5E7EB' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextPrincipal: { color: '#fff' },
  badgeTextReserva: { color: '#374151' },
  cardModel: { fontSize: 18, fontWeight: '700', color: '#111827', paddingHorizontal: 16, marginTop: 6 },
  cardMeta: { fontSize: 14, color: '#4B5563', paddingHorizontal: 16, marginTop: 3, paddingBottom: 4 },
  addLink: { alignSelf: 'center', marginTop: 12, paddingVertical: 8 },
  addLinkText: {
    fontSize: 15,
    color: '#111827',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
});
