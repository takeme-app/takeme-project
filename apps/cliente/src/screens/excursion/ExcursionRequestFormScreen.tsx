import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { mapboxForwardGeocode } from '@take-me/shared';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ExcursionStackParamList } from '../../navigation/types';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAppAlert } from '../../contexts/AppAlertContext';
import { CalendarPicker } from '../../components/CalendarPicker';
import {
  EXCURSION_DESTINATION_PRESETS,
  EXCURSION_PRESET_OTHER_ID,
  type ExcursionDestinationPreset,
} from '../../data/excursionDestinationPresets';

type Props = NativeStackScreenProps<ExcursionStackParamList, 'ExcursionRequestForm'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral700: '#767676',
};

const FLEET_OPTIONS: { value: 'carro' | 'van' | 'micro_onibus' | 'onibus'; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: 'carro', label: 'Carro', icon: 'directions-car' },
  { value: 'van', label: 'Van', icon: 'airport-shuttle' },
  { value: 'micro_onibus', label: 'Micro-Ônibus', icon: 'directions-bus' },
  { value: 'onibus', label: 'Ônibus', icon: 'directions-bus' },
];

const RECREATION_TYPES = [
  { value: 'Bola', label: 'Bola' },
  { value: 'Corda', label: 'Corda' },
  { value: 'Bambolê', label: 'Bambolê' },
  { value: 'Frisbee', label: 'Frisbee' },
];

type RecreationItem = { itemType: string; quantity: string };

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  const day = d.getDate();
  const months = 'jan fev mar abr mai jun jul ago set out nov dez'.split(' ');
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function ExcursionRequestFormScreen({ navigation }: Props) {
  const { showAlert } = useAppAlert();
  const [destination, setDestination] = useState('');
  /** Coordenadas quando o usuário escolhe um destino da lista (evita geocode no envio). */
  const [presetDestCoords, setPresetDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destChipFocus, setDestChipFocus] = useState<string | null>(null);
  const [excursionDate, setExcursionDate] = useState<Date | null>(null);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [peopleCount, setPeopleCount] = useState(2);
  const [fleetType, setFleetType] = useState<'carro' | 'van' | 'micro_onibus' | 'onibus' | null>(null);
  const [firstAidTeam, setFirstAidTeam] = useState(false);
  const [recreationTeam, setRecreationTeam] = useState(false);
  const [childrenTeam, setChildrenTeam] = useState(false);
  const [specialNeedsTeam, setSpecialNeedsTeam] = useState(false);
  const [recreationItems, setRecreationItems] = useState<RecreationItem[]>([{ itemType: '', quantity: '' }]);
  const [dropdownIndex, setDropdownIndex] = useState<number | null>(null);
  const [observations, setObservations] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addRecreationItem = useCallback(() => {
    setRecreationItems((prev) => [...prev, { itemType: '', quantity: '' }]);
  }, []);

  const updateRecreationItem = useCallback((index: number, field: 'itemType' | 'quantity', value: string) => {
    setRecreationItems((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const removeRecreationItem = useCallback((index: number) => {
    setRecreationItems((prev) => prev.filter((_, i) => i !== index));
    setDropdownIndex(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    const dest = destination.trim();
    if (!dest) {
      showAlert('Atenção', 'Informe o destino da excursão.');
      return;
    }
    if (!excursionDate) {
      showAlert('Atenção', 'Selecione a data da excursão.');
      return;
    }
    if (!fleetType) {
      showAlert('Atenção', 'Selecione o tipo de frota.');
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      showAlert('Erro', 'Sessão expirada.');
      return;
    }

    let destinationLat: number | null = presetDestCoords?.lat ?? null;
    let destinationLng: number | null = presetDestCoords?.lng ?? null;
    if (destinationLat == null || destinationLng == null) {
      const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
      if (!token) {
        setSubmitting(false);
        showAlert(
          'Destino no mapa',
          'Escolha um destino da lista ou configure EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN para localizar endereços digitados.',
        );
        return;
      }
      const geo = await mapboxForwardGeocode(`${dest}, Brasil`, token);
      if (!geo) {
        setSubmitting(false);
        showAlert(
          'Destino',
          'Não encontramos esse local. Tente “Cidade, UF” ou escolha um destino da lista.',
        );
        return;
      }
      destinationLat = geo.latitude;
      destinationLng = geo.longitude;
    }

    const recreationItemsPayload = recreationItems
      .filter((r) => r.itemType.trim())
      .map((r) => ({ itemType: r.itemType.trim(), quantity: (r.quantity || '').trim() }));
    const payload = {
      user_id: user.id,
      destination: dest,
      destination_lat: destinationLat,
      destination_lng: destinationLng,
      excursion_date: toISODate(excursionDate),
      people_count: peopleCount,
      fleet_type: fleetType,
      first_aid_team: Boolean(firstAidTeam),
      recreation_team: Boolean(recreationTeam),
      children_team: Boolean(childrenTeam),
      special_needs_team: Boolean(specialNeedsTeam),
      recreation_items: recreationItemsPayload,
      observations: observations.trim() || null,
      status: 'pending',
    };
    const { data: row, error } = await supabase
      .from('excursion_requests')
      .insert(payload)
      .select('id')
      .single();
    setSubmitting(false);
    if (error) {
      const message = error.message || 'Não foi possível enviar a solicitação. Tente novamente.';
      showAlert('Erro', message);
      return;
    }
    navigation.replace('ExcursionSuccess', { requestId: row?.id });
  }, [
    destination,
    excursionDate,
    fleetType,
    peopleCount,
    firstAidTeam,
    recreationTeam,
    childrenTeam,
    specialNeedsTeam,
    recreationItems,
    observations,
    navigation,
    showAlert,
    presetDestCoords,
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.getParent()?.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Excursões</Text>
        <View style={styles.headerSpacer} />
      </View>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Solicite uma excursão</Text>
          <Text style={styles.subtitle}>
            Preencha as informações abaixo e nossa equipe entrará em contato com o orçamento.
          </Text>

          <Text style={styles.label}>Destino da excursão</Text>
          <Text style={styles.destHint}>
            Escolha um local frequente (coordenadas já definidas) ou toque em “Outro” e digite cidade e UF; o app localiza no mapa ao enviar.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
          >
            {EXCURSION_DESTINATION_PRESETS.map((p: ExcursionDestinationPreset) => {
              const selected =
                destChipFocus === p.id ||
                (presetDestCoords != null &&
                  presetDestCoords.lat === p.lat &&
                  presetDestCoords.lng === p.lng &&
                  destination.trim() === p.destinationText);
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.destChip, selected && styles.destChipSelected]}
                  onPress={() => {
                    setDestChipFocus(p.id);
                    setDestination(p.destinationText);
                    setPresetDestCoords({ lat: p.lat, lng: p.lng });
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.destChipText, selected && styles.destChipTextSelected]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.destChip, destChipFocus === EXCURSION_PRESET_OTHER_ID && styles.destChipSelected]}
              onPress={() => {
                setDestChipFocus(EXCURSION_PRESET_OTHER_ID);
                setPresetDestCoords(null);
              }}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.destChipText,
                  destChipFocus === EXCURSION_PRESET_OTHER_ID && styles.destChipTextSelected,
                ]}
              >
                Outro
              </Text>
            </TouchableOpacity>
          </ScrollView>
          <TextInput
            style={styles.input}
            value={destination}
            onChangeText={(t) => {
              setDestination(t);
              setPresetDestCoords(null);
              setDestChipFocus(EXCURSION_PRESET_OTHER_ID);
            }}
            placeholder="Ex.: Bacabal, MA ou nome do município"
            placeholderTextColor={COLORS.neutral700}
          />

          <Text style={styles.label}>Data da excursão</Text>
          <TouchableOpacity style={styles.dateTouch} onPress={() => setDateModalVisible(true)}>
            <Text style={[styles.dateText, !excursionDate && styles.datePlaceholder]}>
              {excursionDate ? formatDisplayDate(toISODate(excursionDate)) : 'Selecione a data'}
            </Text>
            <MaterialIcons name="keyboard-arrow-down" size={24} color={COLORS.black} />
          </TouchableOpacity>

          <View style={styles.separator}>
            <View style={styles.separatorLine} />
          </View>
          <View style={styles.stepperWrap}>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[styles.stepperBtn, peopleCount <= 1 && styles.stepperBtnDisabled]}
                onPress={() => setPeopleCount((c) => Math.max(1, c - 1))}
                disabled={peopleCount <= 1}
              >
                <MaterialIcons name="remove" size={24} color={peopleCount <= 1 ? COLORS.neutral700 : COLORS.black} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{peopleCount} {peopleCount === 1 ? 'pessoa' : 'pessoas'}</Text>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => setPeopleCount((c) => c + 1)}>
                <MaterialIcons name="add" size={24} color={COLORS.black} />
              </TouchableOpacity>
            </View>
            <Text style={styles.stepperHint}>Adicione quem vai viajar com você</Text>
          </View>

          <View style={styles.separator}>
            <View style={styles.separatorLine} />
          </View>
          <Text style={styles.label}>Selecione o tipo de frota</Text>
          <View style={styles.fleetGrid}>
            {FLEET_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.fleetCard, fleetType === opt.value && styles.fleetCardSelected]}
                onPress={() => setFleetType(opt.value)}
                activeOpacity={0.8}
              >
                <MaterialIcons name={opt.icon as any} size={32} color={fleetType === opt.value ? '#FFF' : COLORS.black} />
                <Text style={[styles.fleetLabel, fleetType === opt.value && styles.fleetLabelSelected]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Serviços adicionais</Text>
          <TouchableOpacity style={styles.checkRow} onPress={() => setFirstAidTeam((v) => !v)}>
            <MaterialIcons name={firstAidTeam ? 'check-box' : 'check-box-outline-blank'} size={24} color={COLORS.black} />
            <Text style={styles.checkLabel}>Equipe de primeiros socorros</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.checkRow} onPress={() => setRecreationTeam((v) => !v)}>
            <MaterialIcons name={recreationTeam ? 'check-box' : 'check-box-outline-blank'} size={24} color={COLORS.black} />
            <Text style={styles.checkLabel}>Equipe de recreação</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.checkRow} onPress={() => setChildrenTeam((v) => !v)}>
            <MaterialIcons name={childrenTeam ? 'check-box' : 'check-box-outline-blank'} size={24} color={COLORS.black} />
            <Text style={styles.checkLabel}>Equipe especializada em crianças</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.checkRow} onPress={() => setSpecialNeedsTeam((v) => !v)}>
            <MaterialIcons name={specialNeedsTeam ? 'check-box' : 'check-box-outline-blank'} size={24} color={COLORS.black} />
            <Text style={styles.checkLabel}>Equipe para pessoas com necessidades especiais</Text>
          </TouchableOpacity>

          <View style={styles.separator}>
            <View style={styles.separatorLine} />
          </View>
          <Text style={styles.sectionLabel}>Itens de Recreação</Text>
          {recreationItems.map((item, index) => (
            <View key={index} style={styles.recreationCard}>
              <View style={styles.recreationCardHeader}>
                <Text style={styles.recreationCardTitle}>Objeto de recreação (opcional)</Text>
                <TouchableOpacity onPress={() => removeRecreationItem(index)} hitSlop={8} style={styles.recreationCardRemove}>
                  <MaterialIcons name="close" size={22} color={COLORS.neutral700} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.dropdownTouch}
                onPress={() => setDropdownIndex(dropdownIndex === index ? null : index)}
              >
                <Text style={[styles.dropdownText, !item.itemType && styles.placeholder]}>
                  {item.itemType || 'Selecione o tipo de item'}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={20} color={COLORS.black} />
              </TouchableOpacity>
              <Text style={styles.quantityLabel}>Quantidade (opcional)</Text>
              <TextInput
                style={[styles.input, styles.quantityInput]}
                value={item.quantity}
                onChangeText={(v) => updateRecreationItem(index, 'quantity', v)}
                placeholder="Insira a quantidade"
                placeholderTextColor={COLORS.neutral700}
                keyboardType="number-pad"
              />
            </View>
          ))}
          <TouchableOpacity style={styles.addRecreationBtn} onPress={addRecreationItem}>
            <MaterialIcons name="add" size={20} color={COLORS.black} />
            <Text style={styles.addRecreationText}>Adicionar novo objeto</Text>
          </TouchableOpacity>

          <View style={styles.separator}>
            <View style={styles.separatorLine} />
          </View>
          <View style={styles.optionalRow}>
            <Text style={styles.label}>Detalhes adicionais</Text>
            <Text style={styles.optional}>(Opcional)</Text>
          </View>
          <Text style={styles.labelSecondary}>Observações</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={observations}
            onChangeText={setObservations}
            placeholder="Inclua detalhes adicionais sobre a excursão."
            placeholderTextColor={COLORS.neutral700}
            multiline
          />

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Solicitar orçamento</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={dateModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setDateModalVisible(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Selecione a data</Text>
            <CalendarPicker
              initialDate={excursionDate || today}
              selectedDate={excursionDate}
              onSelectDate={(date) => {
                setExcursionDate(date);
                setDateModalVisible(false);
              }}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setDateModalVisible(false)}>
              <Text style={styles.modalCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={dropdownIndex !== null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setDropdownIndex(null)}>
          <View style={styles.dropdownModal} onStartShouldSetResponder={() => true}>
            {RECREATION_TYPES.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={styles.dropdownOption}
                onPress={() => {
                  if (dropdownIndex !== null) updateRecreationItem(dropdownIndex, 'itemType', opt.value);
                  setDropdownIndex(null);
                }}
              >
                <Text style={styles.dropdownOptionText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  backBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.neutral300, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.black, textAlign: 'center' },
  headerSpacer: { width: 48 },
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 48 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.black, marginTop: 40, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.neutral700, marginBottom: 24 },
  label: { fontSize: 15, fontWeight: '500', color: COLORS.black, marginBottom: 8 },
  destHint: { fontSize: 13, color: COLORS.neutral700, marginBottom: 10, lineHeight: 18 },
  chipsScroll: { marginBottom: 10, maxHeight: 44 },
  chipsContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  destChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: COLORS.neutral300,
    marginRight: 8,
  },
  destChipSelected: { backgroundColor: COLORS.black },
  destChipText: { fontSize: 13, fontWeight: '600', color: COLORS.black },
  destChipTextSelected: { color: '#FFF' },
  labelSecondary: { fontSize: 14, color: COLORS.neutral700, marginBottom: 8 },
  optionalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  optional: { fontSize: 13, color: COLORS.neutral700 },
  input: {
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.black,
    marginBottom: 20,
  },
  textArea: { height: 156, textAlignVertical: 'top', paddingTop: 14 },
  dateTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  dateText: { fontSize: 16, color: COLORS.black },
  datePlaceholder: { color: COLORS.neutral700 },
  separator: { paddingVertical: 40, marginHorizontal: -24 },
  separatorLine: { height: 1, backgroundColor: '#E2E2E2', width: '100%' },
  stepperWrap: { marginBottom: 20 },
  stepperRow: {
    flexDirection: 'row',
    width: 358,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: { opacity: 0.5 },
  stepperValue: { fontSize: 32, fontWeight: '700', color: COLORS.black, textAlign: 'center' },
  stepperHint: { fontSize: 13, color: COLORS.neutral700, textAlign: 'center' },
  fleetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  fleetCard: {
    width: '47%',
    minHeight: 80,
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  fleetCardSelected: { backgroundColor: COLORS.black },
  fleetLabel: { fontSize: 14, fontWeight: '600', color: COLORS.black, marginTop: 8 },
  fleetLabelSelected: { color: '#FFF' },
  sectionLabel: { fontSize: 15, fontWeight: '600', color: COLORS.black, marginBottom: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  checkLabel: { fontSize: 15, color: COLORS.black, marginLeft: 12 },
  recreationCard: {
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  recreationCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  recreationCardTitle: { fontSize: 14, fontWeight: '500', color: COLORS.black },
  recreationCardRemove: { padding: 4 },
  dropdownTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  dropdownText: { fontSize: 16, color: COLORS.black },
  placeholder: { color: COLORS.neutral700 },
  quantityLabel: { fontSize: 14, fontWeight: '500', color: COLORS.black, marginBottom: 8 },
  quantityInput: { marginBottom: 0, backgroundColor: COLORS.background },
  addRecreationBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  addRecreationText: { fontSize: 15, fontWeight: '600', color: COLORS.black },
  submitBtn: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.black, marginBottom: 16 },
  modalClose: { marginTop: 16, alignItems: 'center' },
  modalCloseText: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  dropdownModal: { backgroundColor: '#FFF', borderRadius: 12, padding: 8, minWidth: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  dropdownOption: { paddingVertical: 14, paddingHorizontal: 16 },
  dropdownOptionText: { fontSize: 15, color: COLORS.black },
});
