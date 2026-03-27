import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ColetasExcursoesStackParamList } from '../../navigation/ColetasExcursoesStack';
import { SCREEN_TOP_EXTRA_PADDING } from '../../theme/screenLayout';
import { supabase } from '../../lib/supabase';

// Defensive Mapbox import
let MapboxGL: any = null;
try { MapboxGL = require('@rnmapbox/maps').default; } catch {}

const { height: SCREEN_H } = Dimensions.get('window');
const MAP_HEIGHT = SCREEN_H * 0.38;

// Default coords (São Paulo, Brazil)
const DEFAULT_COORD: [number, number] = [-46.6333, -23.5505];

type Props = NativeStackScreenProps<ColetasExcursoesStackParamList, 'DetalhesExcursao'>;

type ExcursionDetail = {
  id: string;
  origin: string;
  destination: string;
  departureTime: string | null;
  returnTime: string | null;
  passengerCount: number;
  transportType: string;
  responsible: string;
  direction: string;
  status: string;
  originLat: number | null;
  originLng: number | null;
  destLat: number | null;
  destLng: number | null;
};

type StatusConfig = { label: string; bg: string; text: string; border: string };

const STATUS_MAP: Record<string, StatusConfig> = {
  contacted:      { label: 'Em andamento',       bg: '#FEF3C7', text: '#92400E', border: '#C9A227' },
  in_progress:    { label: 'Em andamento',       bg: '#FEF3C7', text: '#92400E', border: '#C9A227' },
  active:         { label: 'Em andamento',       bg: '#FEF3C7', text: '#92400E', border: '#C9A227' },
  payment_done:   { label: 'Pagamento realizado', bg: '#DBEAFE', text: '#1E40AF', border: '#E5E7EB' },
  paid:           { label: 'Pagamento realizado', bg: '#DBEAFE', text: '#1E40AF', border: '#E5E7EB' },
  pending_rating: { label: 'Avaliação Pendente', bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
  confirmed:      { label: 'Concluído',          bg: '#D1FAE5', text: '#065F46', border: '#E5E7EB' },
  completed:      { label: 'Concluído',          bg: '#D1FAE5', text: '#065F46', border: '#E5E7EB' },
  cancelled:      { label: 'Cancelado',          bg: '#FEE2E2', text: '#991B1B', border: '#E5E7EB' },
};

const DEFAULT_STATUS: StatusConfig = { label: 'Pendente', bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' };

function statusCfg(status: string): StatusConfig {
  return STATUS_MAP[status] ?? DEFAULT_STATUS;
}

function formatDateLabel(iso: string | null, direction: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const day = d.getDate().toString().padStart(2, '0');
    const mon = months[d.getMonth()] ?? '';
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${day} ${mon} • ${time} (${direction})`;
  } catch { return '—'; }
}

function timelineSteps(status: string): boolean[] {
  const paymentStatuses = ['payment_done', 'paid', 'pending_rating', 'confirmed', 'completed'];
  const confirmedStatuses = ['confirmed', 'completed'];
  const departedStatuses = ['completed'];
  return [
    true,
    paymentStatuses.includes(status),
    confirmedStatuses.includes(status),
    departedStatuses.includes(status),
  ];
}

const TIMELINE_LABELS = ['Pedido feito', 'Pagamento aprovado', 'Embarque confirmado', 'Ônibus partiu'];
const ACCEPTABLE_STATUSES = ['contacted', 'in_progress', 'active'];

export function DetalhesExcursaoScreen({ navigation, route }: Props) {
  const { excursionId } = route.params;
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [detail, setDetail] = useState<ExcursionDetail | null>(null);
  const cameraRef = useRef<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('excursion_requests')
      .select(
        'id, origin, destination, excursion_date, departure_time, return_time, return_date, people_count, transport_type, responsible_name, direction, status, user_id, origin_lat, origin_lng, destination_lat, destination_lng',
      )
      .eq('id', excursionId)
      .maybeSingle();

    if (!data) { setLoading(false); return; }
    const r = data as any;

    let responsible = r.responsible_name ?? null;
    if (!responsible) {
      const { data: prof } = await supabase
        .from('profiles').select('full_name').eq('id', r.user_id).maybeSingle();
      responsible = (prof as any)?.full_name ?? 'Cliente';
    }

    const depIso = r.departure_time ?? r.excursion_date ?? null;
    const retIso = r.return_time ?? r.return_date ?? null;

    setDetail({
      id: r.id,
      origin: r.origin ?? 'Origem',
      destination: r.destination ?? 'Destino',
      departureTime: depIso,
      returnTime: retIso,
      passengerCount: r.people_count ?? 0,
      transportType: r.transport_type ?? 'Van',
      responsible,
      direction: r.direction ?? 'Ida',
      status: r.status ?? 'pending',
      originLat: r.origin_lat ?? null,
      originLng: r.origin_lng ?? null,
      destLat: r.destination_lat ?? null,
      destLng: r.destination_lng ?? null,
    });
    setLoading(false);
  }, [excursionId]);

  useEffect(() => { load(); }, [load]);

  const handleAccept = useCallback(async () => {
    if (!detail) return;
    setAccepting(true);
    const { error } = await supabase
      .from('excursion_requests')
      .update({ status: 'payment_done', confirmed_at: new Date().toISOString() })
      .eq('id', detail.id);

    if (error) {
      Alert.alert('Erro', 'Não foi possível aceitar a excursão. Tente novamente.');
      setAccepting(false);
      return;
    }
    setAccepting(false);
    await load();
  }, [detail, load]);

  const mapCenter: [number, number] =
    detail?.destLng != null && detail?.destLat != null
      ? [detail.destLng, detail.destLat]
      : DEFAULT_COORD;

  const cfg = detail ? statusCfg(detail.status) : DEFAULT_STATUS;
  const steps = detail ? timelineSteps(detail.status) : [true, false, false, false];
  const canAccept = detail ? ACCEPTABLE_STATUSES.includes(detail.status) : false;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : undefined}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes da Excursão</Text>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
          <MaterialIcons name="notifications-none" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#111827" style={{ marginTop: 48 }} />
      ) : !detail ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="error-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>Excursão não encontrada</Text>
        </View>
      ) : (
        <>
          {/* Map */}
          <View style={[styles.mapWrap, { height: MAP_HEIGHT }]}>
            {MapboxGL ? (
              <MapboxGL.MapView
                style={{ flex: 1 }}
                styleURL="mapbox://styles/mapbox/light-v11"
                logoEnabled={false}
                attributionEnabled={false}
                compassEnabled={false}
              >
                <MapboxGL.Camera
                  ref={cameraRef}
                  centerCoordinate={mapCenter}
                  zoomLevel={12}
                  animationMode="none"
                />

                {/* Destination label pill */}
                <MapboxGL.MarkerView coordinate={mapCenter} anchor={{ x: 0.5, y: 1 }}>
                  <View style={styles.destPill}>
                    <MaterialIcons name="place" size={14} color="#111827" />
                    <Text style={styles.destPillText} numberOfLines={1}>{detail.destination}</Text>
                  </View>
                </MapboxGL.MarkerView>

                {/* Origin marker (if coordinates available) */}
                {detail.originLat != null && detail.originLng != null && (
                  <MapboxGL.MarkerView
                    coordinate={[detail.originLng, detail.originLat]}
                    anchor={{ x: 0.5, y: 1 }}
                  >
                    <View style={styles.originPill}>
                      <MaterialIcons name="trip-origin" size={14} color="#92400E" />
                      <Text style={styles.originPillText} numberOfLines={1}>{detail.origin}</Text>
                    </View>
                  </MapboxGL.MarkerView>
                )}
              </MapboxGL.MapView>
            ) : (
              <View style={styles.mapFallback}>
                <MaterialIcons name="map" size={40} color="#C9B87A" />
                <Text style={styles.mapFallbackText}>{detail.destination}</Text>
              </View>
            )}
          </View>

          {/* Scrollable content */}
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* Status card */}
            <View style={[styles.card, { borderColor: cfg.border }]}>
              <View style={styles.cardTopRow}>
                <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
                </View>
              </View>

              {/* Route */}
              <View style={styles.routeRow}>
                <Text style={styles.routeCity}>{detail.origin}</Text>
                <MaterialIcons name="arrow-forward" size={16} color="#374151" style={{ marginHorizontal: 8 }} />
                <Text style={[styles.routeCity, { textAlign: 'right', flex: 1 }]}>{detail.destination}</Text>
              </View>

              {/* Dates */}
              <View style={styles.datesRow}>
                <Text style={styles.dateLabel}>{formatDateLabel(detail.departureTime, 'ida')}</Text>
                {detail.returnTime ? (
                  <>
                    <Text style={styles.dateSep}> | </Text>
                    <Text style={styles.dateLabel}>{formatDateLabel(detail.returnTime, 'retorno')}</Text>
                  </>
                ) : null}
              </View>

              {/* Detail rows */}
              <View style={styles.detailsSection}>
                <DetailRow label="Passageiros" value={`${detail.passengerCount} passageiros`} />
                <DetailRow label="Tipo de transporte" value={detail.transportType} />
                <DetailRow label="Responsável" value={detail.responsible} />
                <DetailRow label="Navegação" value={detail.direction} />
              </View>
            </View>

            {/* Histórico */}
            <View style={styles.historicoCard}>
              <Text style={styles.historicoTitle}>Histórico</Text>
              {TIMELINE_LABELS.map((label, idx) => (
                <TimelineStep
                  key={label}
                  label={label}
                  done={steps[idx] ?? false}
                  isLast={idx === TIMELINE_LABELS.length - 1}
                />
              ))}
            </View>

          </ScrollView>

          {/* Bottom buttons */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.btnVoltar}
              onPress={() => navigation.canGoBack() ? navigation.goBack() : undefined}
              activeOpacity={0.7}
            >
              <Text style={styles.btnVoltarText}>Voltar</Text>
            </TouchableOpacity>

            {canAccept && (
              <TouchableOpacity
                style={[styles.btnAceitar, accepting && { opacity: 0.6 }]}
                onPress={handleAccept}
                activeOpacity={0.8}
                disabled={accepting}
              >
                {accepting
                  ? <ActivityIndicator size="small" color="#111827" />
                  : <Text style={styles.btnAceitarText}>Aceitar excursão</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function TimelineStep({ label, done, isLast }: { label: string; done: boolean; isLast: boolean }) {
  return (
    <View style={tlStyles.row}>
      <View style={tlStyles.dotCol}>
        <View style={[tlStyles.dot, done ? tlStyles.dotDone : tlStyles.dotPending]} />
        {!isLast && <View style={[tlStyles.line, done ? tlStyles.lineDone : tlStyles.linePending]} />}
      </View>
      <View style={tlStyles.content}>
        <Text style={[tlStyles.label, done ? tlStyles.labelDone : tlStyles.labelPending]}>{label}</Text>
      </View>
    </View>
  );
}

const tlStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  dotCol: { alignItems: 'center', width: 16 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  dotDone: { backgroundColor: '#111827' },
  dotPending: { backgroundColor: '#D1D5DB' },
  line: { flex: 1, width: 2, minHeight: 20, marginTop: 4 },
  lineDone: { backgroundColor: '#111827' },
  linePending: { backgroundColor: '#E5E7EB' },
  content: { flex: 1, paddingBottom: 20 },
  label: { fontSize: 14, fontWeight: '600' },
  labelDone: { color: '#111827' },
  labelPending: { color: '#9CA3AF' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8 + SCREEN_TOP_EXTRA_PADDING,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },

  mapWrap: { width: '100%', backgroundColor: '#F0EDE8' },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapFallbackText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },

  destPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFFFFF', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 3, maxWidth: 180,
  },
  destPillText: { fontSize: 12, fontWeight: '700', color: '#111827', flexShrink: 1 },

  originPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEF3C7', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 2, maxWidth: 160,
  },
  originPillText: { fontSize: 12, fontWeight: '600', color: '#92400E', flexShrink: 1 },

  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },

  card: {
    borderWidth: 1.5, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 16, backgroundColor: '#FFFFFF',
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusPill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  statusText: { fontSize: 13, fontWeight: '700' },

  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  routeCity: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },

  datesRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
  dateLabel: { fontSize: 13, color: '#6B7280' },
  dateSep: { fontSize: 13, color: '#D1D5DB' },

  detailsSection: { gap: 8, paddingTop: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailLabel: { fontSize: 14, color: '#9CA3AF' },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '500', textAlign: 'right' },

  historicoCard: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
    backgroundColor: '#FFFFFF',
  },
  historicoTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 20 },

  bottomBar: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  btnVoltar: {
    flex: 1, height: 50, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  btnVoltarText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  btnAceitar: {
    flex: 2, height: 50, borderRadius: 14,
    backgroundColor: '#F5D06E',
    alignItems: 'center', justifyContent: 'center',
  },
  btnAceitarText: { fontSize: 15, fontWeight: '700', color: '#111827' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },
});
