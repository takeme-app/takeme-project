import { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import { Text } from '../../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapboxMap, MapboxMarker, MapboxPolyline, sanitizeMapRegion } from '../../components/mapbox';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripStackParamList } from '../../navigation/types';
import { ConfirmModal } from '../../components/ConfirmModal';
import { CodeConfirmModal } from '../../components/CodeConfirmModal';
import { AnimatedBottomSheet } from '../../components/AnimatedBottomSheet';

type Props = NativeStackScreenProps<TripStackParamList, 'TripInProgress'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
  orange: '#EA580C',
  green: '#16a34a',
  amber: '#FBBF24',
};

type StepType = 'coleta' | 'entrega';

type Step = {
  id: string;
  type: StepType;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  observations?: string;
  completed: boolean;
};

const MOCK_STEPS: Step[] = [
  {
    id: '1',
    type: 'coleta',
    name: 'Maria Carla',
    address: 'Rua das Flores, 100 - São Paulo',
    latitude: -23.551,
    longitude: -46.634,
    observations: 'Portão azul',
    completed: false,
  },
  {
    id: '2',
    type: 'entrega',
    name: 'Maria Joaquina',
    address: 'Av. Paulista, 500 - São Paulo',
    latitude: -23.552,
    longitude: -46.658,
    observations: 'Receber na portaria',
    completed: false,
  },
];

const ROUTE_COORDS = [
  { latitude: -23.551, longitude: -46.634 },
  { latitude: -23.5515, longitude: -46.64 },
  { latitude: -23.552, longitude: -46.658 },
];

const DEFAULT_REGION = {
  latitude: -23.5515,
  longitude: -46.646,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

export function TripInProgressScreen({ navigation }: Props) {
  const [steps, setSteps] = useState<Step[]>(MOCK_STEPS);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showColetaSheet, setShowColetaSheet] = useState(false);
  const [showEntregaSheet, setShowEntregaSheet] = useState(false);
  const [showFinalizarSheet, setShowFinalizarSheet] = useState(false);
  const [showCancelColetaModal, setShowCancelColetaModal] = useState(false);
  const [showCodeColetaModal, setShowCodeColetaModal] = useState(false);
  const [showCodeEntregaModal, setShowCodeEntregaModal] = useState(false);

  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const isLastStep = currentStepIndex === totalSteps - 1;
  const allCompleted = steps.every((s) => s.completed);

  const openCurrentSheet = () => {
    if (allCompleted) {
      setShowFinalizarSheet(true);
      return;
    }
    if (currentStep.type === 'coleta') setShowColetaSheet(true);
    else setShowEntregaSheet(true);
  };

  const handleStartColeta = () => {
    setShowColetaSheet(false);
    setShowCodeColetaModal(true);
  };

  const handleConfirmColetaCode = (_code: string) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === currentStepIndex ? { ...s, completed: true } : s))
    );
    setCurrentStepIndex((i) => Math.min(i + 1, totalSteps - 1));
  };

  const handleCancelColeta = () => setShowCancelColetaModal(true);
  const handleNaoSeguirColeta = () => setShowCancelColetaModal(false);
  const handleSimCancelarColeta = () => {
    setShowCancelColetaModal(false);
    setShowColetaSheet(false);
  };

  const handleConfirmEntrega = () => {
    setShowEntregaSheet(false);
    setShowCodeEntregaModal(true);
  };

  const handleConfirmEntregaCode = (_code: string) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === currentStepIndex ? { ...s, completed: true } : s))
    );
    if (isLastStep) setShowFinalizarSheet(true);
    else setCurrentStepIndex((i) => i + 1);
  };

  const handleFinalizarViagem = () => {
    setShowFinalizarSheet(false);
    navigation.navigate('RateTrip');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.mapWrap}>
        <MapboxMap style={styles.map} initialRegion={sanitizeMapRegion(DEFAULT_REGION)} scrollEnabled={true}>
          <MapboxPolyline coordinates={ROUTE_COORDS} strokeColor={COLORS.black} strokeWidth={4} />
          {steps.map((step, i) => (
            <MapboxMarker
              key={step.id}
              id={`step-${step.id}`}
              coordinate={{ latitude: step.latitude, longitude: step.longitude }}
              title={step.name}
              description={step.address}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.markerWrap}>
                {step.completed ? (
                  <MaterialIcons name="check-circle" size={32} color={COLORS.green} />
                ) : i === currentStepIndex ? (
                  <MaterialIcons name="play-circle-filled" size={32} color={COLORS.amber} />
                ) : step.type === 'coleta' ? (
                  <MaterialIcons name="person" size={28} color={COLORS.black} />
                ) : (
                  <MaterialIcons name="inventory-2" size={28} color={COLORS.black} />
                )}
              </View>
            </MapboxMarker>
          ))}
        </MapboxMap>
        <View style={styles.timeBadge}>
          <Text style={styles.timeBadgeText}>20 min</Text>
        </View>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={styles.stepsSidebar}>
          {steps.map((step, i) => (
            <View key={step.id} style={styles.stepIconWrap}>
              {step.completed ? (
                <MaterialIcons name="check-circle" size={24} color={COLORS.green} />
              ) : (
                <View style={[styles.stepIconCircle, i === currentStepIndex && styles.stepIconCircleActive]}>
                  <MaterialIcons
                    name={step.type === 'coleta' ? 'person' : 'inventory-2'}
                    size={18}
                    color={i === currentStepIndex ? COLORS.background : COLORS.neutral700}
                  />
                </View>
              )}
              {i < steps.length - 1 && <View style={styles.stepLine} />}
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.currentStepCard} onPress={openCurrentSheet} activeOpacity={0.9}>
        <View style={styles.currentStepHeader}>
          <View style={[styles.stepBadge, currentStep?.type === 'entrega' && styles.stepBadgeEntrega]}>
            <Text style={styles.stepBadgeText}>
              {currentStep?.type === 'coleta' ? 'Coleta' : 'Entrega'}
            </Text>
          </View>
          <Text style={styles.progressText}>{currentStepIndex + 1}/{totalSteps}</Text>
        </View>
        {currentStep && (
          <>
            <Text style={styles.currentStepName}>{currentStep.name}</Text>
            <Text style={styles.currentStepAddress} numberOfLines={2}>{currentStep.address}</Text>
            <View style={styles.etaRow}>
              <MaterialIcons name="schedule" size={16} color={COLORS.neutral700} />
              <Text style={styles.etaText}>20 min</Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${((currentStepIndex + (currentStep.completed ? 1 : 0)) / totalSteps) * 100}%` }]}
              />
            </View>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Chegada prevista em 20 minutos</Text>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
          <TouchableOpacity style={styles.primaryButton} onPress={openCurrentSheet} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>
              {allCompleted ? 'Finalizar viagem' : currentStep?.type === 'coleta' ? 'Detalhes da coleta' : 'Detalhes da entrega'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Sheet: Detalhes da coleta */}
      <AnimatedBottomSheet visible={showColetaSheet} onClose={() => setShowColetaSheet(false)}>
        <View style={styles.detailSheetHeader}>
          <Text style={styles.detailSheetTitle}>Detalhes da coleta</Text>
          <TouchableOpacity><MaterialIcons name="phone" size={24} color={COLORS.black} /></TouchableOpacity>
        </View>
        {currentStep && (
          <>
            <View style={styles.detailUserRow}>
              <View style={styles.detailAvatar} />
              <View style={styles.detailUserInfo}>
                <Text style={styles.detailUserName}>{currentStep.name}</Text>
                <Text style={styles.detailRating}>★ 4.8</Text>
                <Text style={styles.detailBag}>Mala pequena</Text>
              </View>
            </View>
            <Text style={styles.detailLabel}>Endereço da coleta</Text>
            <Text style={styles.detailAddress}>{currentStep.address}</Text>
            {currentStep.observations && (
              <>
                <Text style={styles.detailLabel}>Observações</Text>
                <Text style={styles.detailObservations}>{currentStep.observations}</Text>
              </>
            )}
            <TouchableOpacity style={styles.detailPrimaryButton} onPress={handleStartColeta} activeOpacity={0.8}>
              <Text style={styles.detailPrimaryButtonText}>Iniciar coleta</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.detailSecondaryButton} onPress={handleCancelColeta} activeOpacity={0.8}>
              <Text style={styles.detailSecondaryButtonText}>Cancelar coleta</Text>
            </TouchableOpacity>
          </>
        )}
      </AnimatedBottomSheet>

      {/* Sheet: Entrega para [nome] */}
      <AnimatedBottomSheet visible={showEntregaSheet} onClose={() => setShowEntregaSheet(false)}>
        <Text style={styles.detailSheetTitle}>Entrega para {currentStep?.name}</Text>
        {currentStep && (
          <>
            <View style={styles.entregaTypeRow}>
              <MaterialIcons name="inventory-2" size={24} color={COLORS.neutral700} />
              <Text style={styles.entregaTypeText}>Pacote</Text>
            </View>
            <Text style={styles.detailLabel}>Local de entrega</Text>
            <Text style={styles.detailAddress}>{currentStep.address}</Text>
            {currentStep.observations && (
              <>
                <Text style={styles.detailLabel}>Observações</Text>
                <Text style={styles.detailObservations}>{currentStep.observations}</Text>
              </>
            )}
            <TouchableOpacity style={styles.detailPrimaryButton} onPress={handleConfirmEntrega} activeOpacity={0.8}>
              <Text style={styles.detailPrimaryButtonText}>Confirmar entrega</Text>
            </TouchableOpacity>
          </>
        )}
      </AnimatedBottomSheet>

      {/* Sheet: Finalizar viagem */}
      <AnimatedBottomSheet visible={showFinalizarSheet} onClose={() => setShowFinalizarSheet(false)}>
        <Text style={styles.detailSheetTitle}>Finalizar viagem</Text>
        <View style={styles.finalizarRow}>
          <Text style={styles.finalizarLabel}>Tempo total</Text>
          <Text style={styles.finalizarValue}>45 min</Text>
        </View>
        <View style={styles.finalizarRow}>
          <Text style={styles.finalizarLabel}>Distância</Text>
          <Text style={styles.finalizarValue}>12 km</Text>
        </View>
        <View style={styles.statusConcluidoWrap}>
          <MaterialIcons name="check-circle" size={24} color={COLORS.green} />
          <Text style={styles.statusConcluidoText}>Concluído</Text>
        </View>
        <Text style={styles.detailLabel}>Anexar despesas (opcional)</Text>
        <TouchableOpacity style={styles.uploadExpenseBox} activeOpacity={0.8}>
          <MaterialIcons name="cloud-upload" size={32} color={COLORS.neutral700} />
          <Text style={styles.uploadExpenseText}>Envie o comprovante</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.detailPrimaryButton} onPress={handleFinalizarViagem} activeOpacity={0.8}>
          <Text style={styles.detailPrimaryButtonText}>Enviar e finalizar viagem</Text>
        </TouchableOpacity>
      </AnimatedBottomSheet>

      <ConfirmModal
        visible={showCancelColetaModal}
        onClose={() => setShowCancelColetaModal(false)}
        title="Tem certeza que deseja cancelar esta coleta?"
        subtitle="O passageiro será notificado imediatamente."
        primaryLabel="Não, seguir com a viagem"
        onPrimary={handleNaoSeguirColeta}
        secondaryLabel="Sim, cancelar"
        onSecondary={handleSimCancelarColeta}
      />

      <CodeConfirmModal
        visible={showCodeColetaModal}
        onClose={() => setShowCodeColetaModal(false)}
        title="Confirmar coleta"
        instruction="Insira o código informado pelo passageiro para confirmar a coleta."
        inputPlaceholder="Ex: 1234"
        submitLabel="Confirmar coleta"
        onSubmit={handleConfirmColetaCode}
        backLabel="Voltar"
      />

      <CodeConfirmModal
        visible={showCodeEntregaModal}
        onClose={() => setShowCodeEntregaModal(false)}
        title="Confirmar entrega"
        instruction="Insira o código informado pelo cliente para confirmar a entrega."
        inputPlaceholder="Ex: 1234"
        submitLabel="Confirmar entrega"
        onSubmit={handleConfirmEntregaCode}
        backLabel="Voltar"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  mapWrap: { height: 280, width: '100%' },
  map: { width: '100%', height: '100%' },
  markerWrap: { alignItems: 'center', justifyContent: 'center' },
  timeBadge: {
    position: 'absolute',
    bottom: 12,
    left: 24,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  timeBadgeText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 48,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backArrow: { fontSize: 22, color: COLORS.black, fontWeight: '600' },
  stepsSidebar: {
    position: 'absolute',
    left: 16,
    top: 100,
    alignItems: 'center',
  },
  stepIconWrap: { alignItems: 'center' },
  stepIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconCircleActive: { backgroundColor: COLORS.amber },
  stepLine: { width: 2, height: 24, backgroundColor: COLORS.neutral400, marginVertical: 2 },
  currentStepCard: {
    marginHorizontal: 24,
    marginTop: -12,
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  currentStepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  stepBadge: { backgroundColor: COLORS.amber, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  stepBadgeEntrega: { backgroundColor: COLORS.neutral400 },
  stepBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.black },
  progressText: { fontSize: 12, fontWeight: '600', color: COLORS.neutral700 },
  currentStepName: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  currentStepAddress: { fontSize: 14, color: COLORS.neutral700, marginTop: 4 },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  etaText: { fontSize: 14, color: COLORS.neutral700 },
  progressBar: { height: 4, backgroundColor: COLORS.neutral300, borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.amber, borderRadius: 2 },
  sheet: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 12,
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: COLORS.black, marginBottom: 20, textAlign: 'center' },
  scrollContent: { paddingBottom: 32 },
  card: {
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
  primaryButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  detailSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  sheetClose: { position: 'absolute', top: 16, right: 16, zIndex: 1 },
  detailSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  detailSheetTitle: { fontSize: 20, fontWeight: '700', color: COLORS.black, marginBottom: 16 },
  detailUserRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  detailAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.neutral300, marginRight: 12 },
  detailUserInfo: { flex: 1 },
  detailUserName: { fontSize: 18, fontWeight: '700', color: COLORS.black },
  detailRating: { fontSize: 14, color: COLORS.neutral700 },
  detailBag: { fontSize: 14, color: COLORS.neutral700 },
  detailLabel: { fontSize: 14, fontWeight: '600', color: COLORS.neutral700, marginTop: 12, marginBottom: 4 },
  detailAddress: { fontSize: 14, color: COLORS.black },
  detailObservations: { fontSize: 14, color: COLORS.neutral700 },
  detailPrimaryButton: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: COLORS.black,
    alignItems: 'center',
  },
  detailPrimaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  detailSecondaryButton: { marginTop: 12, paddingVertical: 14, alignItems: 'center' },
  detailSecondaryButtonText: { fontSize: 16, fontWeight: '600', color: '#dc2626' },
  entregaTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  entregaTypeText: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  finalizarRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  finalizarLabel: { fontSize: 14, color: COLORS.neutral700 },
  finalizarValue: { fontSize: 14, fontWeight: '600', color: COLORS.black },
  statusConcluidoWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 16 },
  statusConcluidoText: { fontSize: 16, fontWeight: '700', color: COLORS.green },
  uploadExpenseBox: {
    borderWidth: 1,
    borderColor: COLORS.neutral300,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  uploadExpenseText: { fontSize: 14, color: COLORS.neutral700 },
});
