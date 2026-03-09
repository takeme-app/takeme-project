import { useState, useEffect, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { Text } from '../../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapboxMap, MapboxMarker, MapboxPolyline } from '../../components/mapbox';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ActivitiesStackParamList } from '../../navigation/ActivitiesStackTypes';
import { supabase } from '../../lib/supabase';
import { getRoutePolyline, type RoutePoint } from '../../lib/route';
import { useAppAlert } from '../../contexts/AppAlertContext';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

type Props = NativeStackScreenProps<ActivitiesStackParamList, 'DependentShipmentDetail'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
  accent: '#EAB308',
};

function formatDetailDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const months = 'Jan Fev Mar Abr Mai Jun Jul Ago Set Out Nov Dez'.split(' ');
  const month = months[d.getMonth()];
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${day} ${month} • ${hours}:${minutes}`;
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function dependentShipmentStatusMessage(status: string): string {
  switch (status) {
    case 'in_progress':
    case 'confirmed':
      return 'Tudo certo com seu envio!';
    case 'pending_review':
      return 'Pendente de revisão';
    case 'delivered':
      return 'Concluído';
    case 'cancelled':
      return 'Envio cancelado';
    default:
      return 'Pendente de revisão';
  }
}

type DetailRow = {
  id: string;
  user_id: string;
  dependent_id: string | null;
  full_name: string;
  contact_phone: string;
  bags_count: number;
  instructions: string | null;
  origin_address: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_address: string;
  destination_lat: number | null;
  destination_lng: number | null;
  amount_cents: number;
  status: string;
  created_at: string;
};

export function DependentShipmentDetailScreen({ navigation, route }: Props) {
  const dependentShipmentId = route.params?.dependentShipmentId ?? '';
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();
  const [detail, setDetail] = useState<DetailRow | null>(null);
  const [senderName, setSenderName] = useState<string | null>(null);
  const [senderAvatarUrl, setSenderAvatarUrl] = useState<string | null>(null);
  const [dependentAge, setDependentAge] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeCoords, setRouteCoords] = useState<RoutePoint[] | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!dependentShipmentId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: row, error } = await supabase
        .from('dependent_shipments')
        .select('id, user_id, dependent_id, full_name, contact_phone, bags_count, instructions, origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng, amount_cents, status, created_at')
        .eq('id', dependentShipmentId)
        .eq('user_id', user.id)
        .single();
      if (cancelled || error || !row) {
        setLoading(false);
        return;
      }
      setDetail(row as DetailRow);
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', row.user_id)
        .single();
      if (!cancelled) {
        const p = profile as { full_name?: string; avatar_url?: string | null } | null;
        setSenderName(p?.full_name ?? null);
        setSenderAvatarUrl(p?.avatar_url ?? null);
      }
      if (!cancelled && (row as DetailRow).dependent_id) {
        const { data: dep } = await supabase
          .from('dependents')
          .select('age')
          .eq('id', (row as DetailRow).dependent_id)
          .single();
        if (!cancelled && dep && (dep as { age?: string | null }).age)
          setDependentAge((dep as { age: string }).age);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dependentShipmentId]);

  useEffect(() => {
    if (!detail?.origin_lat || !detail?.origin_lng || !detail?.destination_lat || !detail?.destination_lng) return;
    let cancelled = false;
    getRoutePolyline(
      { latitude: detail.origin_lat, longitude: detail.origin_lng },
      { latitude: detail.destination_lat, longitude: detail.destination_lng }
    ).then((coords) => {
      if (!cancelled && coords?.length) setRouteCoords(coords);
    });
    return () => { cancelled = true; };
  }, [detail?.origin_lat, detail?.origin_lng, detail?.destination_lat, detail?.destination_lng]);

  const mapRegion = useMemo(() => {
    if (!detail?.origin_lat || !detail?.origin_lng || !detail?.destination_lat || !detail?.destination_lng) return null;
    const latMin = Math.min(detail.origin_lat, detail.destination_lat);
    const latMax = Math.max(detail.origin_lat, detail.destination_lat);
    const lngMin = Math.min(detail.origin_lng, detail.destination_lng);
    const lngMax = Math.max(detail.origin_lng, detail.destination_lng);
    const padding = 0.01;
    return {
      latitude: (latMin + latMax) / 2,
      longitude: (lngMin + lngMax) / 2,
      latitudeDelta: Math.max(0.05, latMax - latMin + padding * 2),
      longitudeDelta: Math.max(0.05, lngMax - lngMin + padding * 2),
    };
  }, [detail]);

  const canCancel = detail?.status && ['pending_review', 'confirmed'].includes(detail.status);

  const handleConfirmCancel = async () => {
    if (!detail?.id) return;
    setCancelling(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCancelling(false);
      setShowCancelModal(false);
      return;
    }
    const { error } = await supabase
      .from('dependent_shipments')
      .update({ status: 'cancelled' })
      .eq('id', detail.id)
      .eq('user_id', user.id);
    setCancelling(false);
    setShowCancelModal(false);
    if (error) {
      showAlert('Erro', 'Não foi possível cancelar o envio.');
      return;
    }
    setDetail((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
  };

  const openChat = () => {
    navigation.navigate('Chat', { contactName: 'Contato do envio' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="close" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhes do envio do dependente</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.black} />
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="close" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhes do envio do dependente</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.placeholder}>Envio não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const contactDisplay = formatPhoneDisplay(detail.contact_phone);
  const statusLabel = dependentShipmentStatusMessage(detail.status);
  const isDelivered = detail.status === 'delivered';
  const senderAvatarUri = senderAvatarUrl
    ? (senderAvatarUrl.startsWith('http') ? senderAvatarUrl : `${supabaseUrl}/storage/v1/object/public/avatars/${senderAvatarUrl}`)
    : null;
  const createdTime = formatDetailDate(detail.created_at).split(' • ')[1] ?? '—';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="close" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes do envio do dependente</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(40, insets.bottom + 24) }]}
        showsVerticalScrollIndicator={false}
      >
        {mapRegion && detail.origin_lat != null && detail.origin_lng != null && detail.destination_lat != null && detail.destination_lng != null && (
          <View style={styles.mapSection}>
            <View style={styles.mapContainer}>
              <MapboxMap style={styles.map} initialRegion={mapRegion} scrollEnabled={false}>
                <MapboxMarker
                  id="origin"
                  coordinate={{ latitude: detail.origin_lat, longitude: detail.origin_lng }}
                  anchor={{ x: 0.5, y: 1 }}
                  pinColor="#0d0d0d"
                />
                <MapboxMarker
                  id="destination"
                  coordinate={{ latitude: detail.destination_lat, longitude: detail.destination_lng }}
                  anchor={{ x: 0.5, y: 1 }}
                  pinColor="#2563eb"
                />
                {routeCoords && routeCoords.length > 0 && (
                  <MapboxPolyline coordinates={routeCoords} strokeColor={COLORS.black} strokeWidth={4} />
                )}
              </MapboxMap>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitleFull} numberOfLines={1}>
              Envio TakeMe com {senderName ?? '—'}
            </Text>
            <View style={styles.cardAvatarWrap}>
              {senderAvatarUri ? (
                <Image source={{ uri: senderAvatarUri }} style={styles.cardAvatar} />
              ) : (
                <View style={styles.cardAvatarPlaceholder}>
                  <Text style={styles.cardAvatarInitial}>{(senderName ?? '?').charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.cardDate}>{formatDetailDate(detail.created_at)}</Text>
          <View style={styles.cardPriceRow}>
            <Text style={styles.cardPrice}>R$ {(detail.amount_cents / 100).toFixed(2).replace('.', ',')}</Text>
            <Text style={[styles.cardStatus, isDelivered && styles.cardStatusGreen]}>{statusLabel}</Text>
          </View>
          <TouchableOpacity style={styles.reciboChip} activeOpacity={0.8}>
            <MaterialIcons name="description" size={18} color={COLORS.black} />
            <Text style={styles.reciboChipText}>Recibo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.routeSection}>
          <View style={styles.routeRow}>
            <View style={styles.routeIconCircle} />
            <Text style={styles.routeAddress} numberOfLines={2}>{detail.origin_address}</Text>
            <Text style={styles.routeTime}>{createdTime}</Text>
          </View>
          <View style={styles.routeRow}>
            <View style={styles.routeIconSquare} />
            <Text style={styles.routeAddress} numberOfLines={2}>{detail.destination_address}</Text>
            <Text style={styles.routeTime}>—</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionHeading}>Dependente</Text>
          <View style={styles.dependentNameRow}>
            <MaterialIcons name="person-outline" size={20} color={COLORS.neutral700} style={styles.infoIcon} />
            <Text style={styles.infoText}>
              {detail.full_name}{dependentAge ? ` • ${dependentAge} anos` : ''}
            </Text>
          </View>
          <View style={styles.bagsRow}>
            <MaterialIcons name="luggage" size={24} color={COLORS.neutral700} />
            <Text style={styles.bagsCount}>
              {detail.bags_count} {detail.bags_count === 1 ? 'mala' : 'malas'}
            </Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionHeading}>Recebedor</Text>
          <View style={styles.recipientRow}>
            <View style={styles.recipientTextWrap}>
              <View style={styles.dependentNameRow}>
                <MaterialIcons name="person-outline" size={20} color={COLORS.neutral700} style={styles.infoIcon} />
                <Text style={styles.infoText}>Telefone: {contactDisplay || detail.contact_phone}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.chatIconButton} onPress={openChat} activeOpacity={0.8}>
              <MaterialIcons name="chat-bubble-outline" size={24} color={COLORS.accent} />
            </TouchableOpacity>
          </View>
        </View>

        {detail.instructions ? (
          <View style={styles.infoSection}>
            <View style={styles.instrucoesContent}>
              <MaterialIcons name="description" size={20} color={COLORS.neutral700} style={styles.instrucoesIcon} />
              <View style={styles.instrucoesTextWrap}>
                <Text style={styles.sectionHeadingSmall}>Instruções de entrega</Text>
                <Text style={styles.infoText}>{detail.instructions}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {canCancel && (
          <TouchableOpacity style={styles.cancelButton} onPress={() => setShowCancelModal(true)} activeOpacity={0.8}>
            <Text style={styles.cancelButtonText}>Cancelar envio</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={showCancelModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalBox}>
            <Text style={styles.confirmModalTitle}>Tem certeza que deseja cancelar este envio?</Text>
            <Text style={styles.confirmModalSubtitle}>O envio do dependente será cancelado.</Text>
            <TouchableOpacity
              style={styles.confirmModalPrimary}
              activeOpacity={0.8}
              onPress={() => setShowCancelModal(false)}
              disabled={cancelling}
            >
              <Text style={styles.confirmModalPrimaryText}>Manter envio</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmModalSecondary}
              activeOpacity={0.8}
              onPress={handleConfirmCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color="#dc2626" />
              ) : (
                <Text style={styles.confirmModalSecondaryText}>Cancelar envio</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral300,
  },
  closeButton: { padding: 4, width: 32 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.black, flex: 1, textAlign: 'center' },
  headerSpacer: { width: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  placeholder: { fontSize: 15, color: COLORS.neutral700 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  mapSection: { paddingHorizontal: 24, paddingTop: 16 },
  mapContainer: { width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', backgroundColor: COLORS.neutral300 },
  map: { width: '100%', height: '100%', borderRadius: 12 },
  card: {
    marginHorizontal: 24,
    marginTop: 24,
    padding: 16,
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitleFull: { fontSize: 16, fontWeight: '700', color: COLORS.black, flex: 1, marginRight: 12 },
  cardAvatarWrap: { flexShrink: 0 },
  cardAvatar: { width: 40, height: 40, borderRadius: 20 },
  cardAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.neutral400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAvatarInitial: { fontSize: 18, fontWeight: '700', color: COLORS.neutral700 },
  cardDate: { fontSize: 14, color: COLORS.neutral700, marginTop: 10 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  cardPrice: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  cardStatus: { fontSize: 14, fontWeight: '600', color: COLORS.neutral700 },
  cardStatusGreen: { color: '#16a34a' },
  reciboChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.neutral400,
  },
  reciboChipText: { fontSize: 14, fontWeight: '600', color: COLORS.black },
  routeSection: { marginHorizontal: 24, marginTop: 24, gap: 16 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeTime: { fontSize: 14, color: COLORS.neutral700, flexShrink: 0 },
  routeIconCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.neutral700,
  },
  routeIconSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: COLORS.neutral700,
  },
  routeAddress: { flex: 1, fontSize: 14, color: COLORS.black, minWidth: 0 },
  infoSection: { marginHorizontal: 24, marginTop: 24 },
  sectionHeading: { fontSize: 16, fontWeight: '700', color: COLORS.black, marginBottom: 10 },
  sectionHeadingSmall: { fontSize: 14, fontWeight: '600', color: COLORS.black, marginBottom: 4 },
  dependentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoIcon: { marginTop: 2 },
  infoText: { fontSize: 14, color: COLORS.black, marginTop: 2, flex: 1 },
  bagsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  bagsCount: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  recipientRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  recipientTextWrap: { flex: 1, minWidth: 0 },
  chatIconButton: { padding: 8, marginLeft: 4 },
  instrucoesContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 },
  instrucoesTextWrap: { flex: 1, minWidth: 0 },
  instrucoesIcon: { marginTop: 2 },
  cancelButton: {
    marginHorizontal: 24,
    marginTop: 28,
    paddingVertical: 16,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.background },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmModalBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 24,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmModalSubtitle: {
    fontSize: 14,
    color: COLORS.neutral700,
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmModalPrimary: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: COLORS.black,
    alignItems: 'center',
  },
  confirmModalPrimaryText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  confirmModalSecondary: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
  },
  confirmModalSecondaryText: { fontSize: 16, fontWeight: '600', color: '#dc2626' },
});
