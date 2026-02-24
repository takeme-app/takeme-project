import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TripStackParamList, 'PaymentConfirmed'>;

export function PaymentConfirmedScreen({ navigation }: Props) {
  const [showBookingModal, setShowBookingModal] = useState(true);

  const goToMain = () => {
    navigation.getParent()?.navigate('Main');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <Modal visible={showBookingModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Agendamento confirmado!</Text>
            <Text style={styles.modalText}>
              Sua viagem para São Paulo, SP foi agendada para 3 de outubro de 2025.
            </Text>
            <Text style={styles.modalText}>Você receberá uma confirmação em breve.</Text>
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
      <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('DriverOnTheWay')} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>Acompanhar viagem</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkButton} onPress={goToMain}>
        <Text style={styles.linkButtonText}>Ver em Atividades</Text>
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
  title: { fontSize: 22, fontWeight: '700', color: '#0d0d0d', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#0d0d0d', marginBottom: 8, textAlign: 'center' },
  hint: { fontSize: 14, color: '#767676', marginBottom: 32, textAlign: 'center' },
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
  secondaryButtonText: { fontSize: 16, fontWeight: '500', color: '#0d0d0d' },
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
