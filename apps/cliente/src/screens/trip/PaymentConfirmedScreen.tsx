import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Text } from '../../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TripStackParamList, 'PaymentConfirmed'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  grey: '#767676',
};

export function PaymentConfirmedScreen({ navigation, route }: Props) {
  const [showBookingModal, setShowBookingModal] = useState(true);
  const booking = route.params?.booking;
  const immediateTrip = route.params?.immediateTrip === true;

  const destinationLabel = booking?.destination_address ?? 'destino';
  const tripSummary = booking
    ? `Saída ${booking.departure} · Chegada ${booking.arrival}. Motorista: ${booking.driver_name}. Valor: R$ ${(booking.amount_cents / 100).toFixed(2)}.`
    : '';

  const goToMain = () => {
    navigation.getParent()?.navigate('Main');
  };

  const goToActivities = () => {
    navigation.getParent()?.navigate('Main', { screen: 'Activities' });
  };

  if (immediateTrip) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.iconWrap}>
          <MaterialIcons name="check" size={48} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Pagamento confirmado!</Text>
        <Text style={styles.subtitleGrey}>Seu motorista já está a caminho.</Text>
        <Text style={styles.instruction}>
          Acompanhe em tempo real a localização e a previsão de chegada.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('DriverOnTheWay', route.params?.tripLive)}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Acompanhar viagem</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={goToMain} activeOpacity={0.8}>
          <Text style={styles.secondaryButtonText}>Voltar para Início</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <Modal visible={showBookingModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Solicitação enviada!</Text>
            <Text style={styles.modalText}>
              Sua viagem para {destinationLabel} foi solicitada ao motorista.
            </Text>
            {tripSummary ? <Text style={styles.modalText}>{tripSummary}</Text> : null}
            <Text style={styles.modalText}>
              Você receberá a confirmação assim que o motorista aceitar a corrida.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowBookingModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <View style={styles.iconWrap}>
        <MaterialIcons name="check" size={48} color="#FFFFFF" />
      </View>
      <Text style={styles.title}>Pagamento confirmado!</Text>
      <Text style={styles.subtitle}>Sua viagem foi agendada com sucesso.</Text>
      <Text style={styles.hint}>Você poderá acompanhar o status e detalhes em Atividades.</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={goToActivities} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>Ver em Atividades</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('DriverOnTheWay', route.params?.tripLive)}>
        <Text style={styles.linkButtonText}>Acompanhar viagem</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={goToMain}>
        <Text style={styles.secondaryButtonText}>Voltar para Início</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 24, alignItems: 'center', paddingTop: 48 },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0d0d0d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.black, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, color: COLORS.black, marginBottom: 8, textAlign: 'center' },
  subtitleGrey: { fontSize: 16, color: COLORS.grey, marginBottom: 16, textAlign: 'center' },
  instruction: { fontSize: 15, color: COLORS.black, marginBottom: 32, textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 },
  hint: { fontSize: 14, color: COLORS.grey, marginBottom: 32, textAlign: 'center' },
  primaryButton: {
    backgroundColor: '#0d0d0d',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  linkButton: { paddingVertical: 12 },
  linkButtonText: { fontSize: 16, fontWeight: '500', color: '#0d0d0d' },
  secondaryButton: { paddingVertical: 12 },
  secondaryButtonText: { fontSize: 16, fontWeight: '500', color: COLORS.black },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#0d0d0d', marginBottom: 16, textAlign: 'center' },
  modalText: { fontSize: 15, color: '#767676', marginBottom: 8, textAlign: 'center' },
  modalButton: {
    backgroundColor: '#0d0d0d',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  modalButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
