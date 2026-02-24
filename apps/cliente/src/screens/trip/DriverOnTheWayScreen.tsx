import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TripStackParamList, 'DriverOnTheWay'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
  orange: '#EA580C',
};

const DEFAULT_REGION = {
  latitude: -23.5505,
  longitude: -46.6333,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export function DriverOnTheWayScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.mapWrap}>
        <MapView style={styles.map} initialRegion={DEFAULT_REGION} scrollEnabled={false} />
      </View>
      <View style={styles.banner}>
        <MaterialIcons name="check-circle" size={24} color="#FFFFFF" />
        <Text style={styles.bannerText}>Seu motorista chega em 4 minutos</Text>
      </View>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.getParent()?.goBack()}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Chega em 4 minutos</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Motorista</Text>
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar} />
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>Carlos Silva</Text>
              <Text style={styles.driverRating}>★ 4.8</Text>
              <Text style={styles.carText}>Argo Sedan • Placa RIO 2877</Text>
            </View>
            <Text style={styles.fare}>R$ 64,00</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Código de confirmação</Text>
          <View style={styles.codeWrap}>
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>1234 ✓</Text>
            </View>
          </View>
          <Text style={styles.codeHint}>Informe este código ao motorista para confirmar a viagem.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Passageiros</Text>
          <View style={styles.passengerRow}>
            <MaterialIcons name="person-outline" size={20} color={COLORS.neutral700} />
            <Text style={styles.passengerText}>João Silva · CPF: 123.456.789-00</Text>
          </View>
          <View style={styles.passengerRow}>
            <MaterialIcons name="person-outline" size={20} color={COLORS.neutral700} />
            <Text style={styles.passengerText}>Maria Santos · CPF: 987.654.321-00</Text>
          </View>
          <Text style={styles.bagsNote}>2 malas adicionadas</Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('TripInProgress')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Acompanhar viagem</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  mapWrap: { height: 200, width: '100%' },
  map: { width: '100%', height: '100%' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.black,
    paddingVertical: 14,
    gap: 8,
  },
  bannerText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 48,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backArrow: { fontSize: 22, color: COLORS.black, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 32 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: COLORS.black, marginBottom: 16, textAlign: 'center' },
  card: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.neutral300,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.black, marginBottom: 12 },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.neutral300, marginRight: 12 },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  driverRating: { fontSize: 14, color: COLORS.neutral700 },
  carText: { fontSize: 13, color: COLORS.neutral700, marginTop: 2 },
  fare: { fontSize: 18, fontWeight: '700', color: COLORS.orange },
  codeWrap: { alignItems: 'center', marginVertical: 12 },
  codeBadge: { backgroundColor: '#22C55E', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  codeText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  codeHint: { fontSize: 13, color: COLORS.neutral700, textAlign: 'center' },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  passengerText: { flex: 1, fontSize: 14, color: COLORS.black },
  bagsNote: { fontSize: 13, color: COLORS.neutral700, marginTop: 4 },
  primaryButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
