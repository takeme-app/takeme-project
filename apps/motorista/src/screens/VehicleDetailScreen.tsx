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
import type { ProfileStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { SCREEN_TOP_EXTRA_PADDING } from '../theme/screenLayout';
import { normalizeVehiclePhotosUrls, resolveVehiclePhotoUris } from '../utils/storageUrl';

type Props = NativeStackScreenProps<ProfileStackParamList, 'VehicleDetail'>;

type VehicleDetail = {
  id: string;
  model: string;
  plate: string;
  year: number;
  passenger_capacity: number;
  renavam: string | null;
  use_type: string | null;
  vehicle_document_url: string | null;
  vehicle_photos_urls: string[] | null;
};

function docFilename(url: string | null): string | null {
  if (!url) return null;
  const parts = url.split('/');
  return parts[parts.length - 1] ?? url;
}

export function VehicleDetailScreen({ navigation, route }: Props) {
  const { vehicleId } = route.params;
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [resolvedPhotos, setResolvedPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('vehicles')
      .select('id, model, plate, year, passenger_capacity, renavam, use_type, vehicle_document_url, vehicle_photos_urls')
      .eq('id', vehicleId)
      .maybeSingle();
    const v = data as VehicleDetail | null;
    if (v) {
      const paths = normalizeVehiclePhotosUrls(v.vehicle_photos_urls);
      const signed = await resolveVehiclePhotoUris(paths);
      setResolvedPhotos(signed.filter((u): u is string => Boolean(u)));
    } else {
      setResolvedPhotos([]);
    }
    setVehicle(v);
    setLoading(false);
  }, [vehicleId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <MaterialIcons name="close" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhes do veículo</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Veículo não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isPrincipal = (vehicle.use_type ?? 'principal') === 'principal';
  const docName = docFilename(vehicle.vehicle_document_url);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="close" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes do veículo</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('VehicleForm', { vehicleId: vehicle.id })}
          activeOpacity={0.7}
        >
          <MaterialIcons name="edit" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardModel}>{vehicle.model}</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Ano</Text>
            <Text style={styles.rowValue}>{vehicle.year}</Text>
          </View>
          <View style={styles.divider} />

          {vehicle.renavam ? (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Renavam</Text>
                <Text style={styles.rowValue}>{vehicle.renavam}</Text>
              </View>
              <View style={styles.divider} />
            </>
          ) : null}

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Capacidade de passageiros</Text>
            <Text style={styles.rowValue}>{vehicle.passenger_capacity} passageiros</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Tipo de veículo</Text>
            <Text style={styles.rowValue}>{isPrincipal ? 'Principal' : 'Reserva'}</Text>
          </View>

          {docName ? (
            <>
              <View style={styles.divider} />
              <View style={styles.docRow}>
                <MaterialIcons name="insert-drive-file" size={22} color="#9CA3AF" />
                <Text style={styles.docName} numberOfLines={1}>{docName}</Text>
              </View>
            </>
          ) : null}

          {resolvedPhotos.length > 0 ? (
            <>
              <View style={styles.divider} />
              <View style={styles.photoGrid}>
                {resolvedPhotos.map((uri, i) => (
                  <View key={i} style={styles.photoCell}>
                    <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#6B7280', fontSize: 15 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8 + SCREEN_TOP_EXTRA_PADDING,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
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
  scroll: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardModel: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowLabel: { fontSize: 14, color: '#9CA3AF', fontWeight: '400' },
  rowValue: { fontSize: 15, fontWeight: '700', color: '#111827', textAlign: 'right', flex: 1, marginLeft: 16 },
  divider: { height: 1, backgroundColor: '#F3F4F6' },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  docName: { fontSize: 14, color: '#374151', flex: 1 },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 14,
  },
  photoCell: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  photo: { width: '100%', height: '100%' },
});
