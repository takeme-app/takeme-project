import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral700: '#767676',
  yellowLight: '#FEF3C7',
  yellowCircle: '#FBBF24',
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenChat?: () => void;
};

const SUPPORT_PHONE = 'tel:+5511999999999';
const SUPPORT_WHATSAPP = 'https://wa.me/5511999999999';

export function SupportSheet({ visible, onClose, onOpenChat }: Props) {
  const handleCall = () => {
    Linking.openURL(SUPPORT_PHONE);
    onClose();
  };

  const handleWhatsApp = () => {
    Linking.openURL(SUPPORT_WHATSAPP);
    onClose();
  };

  const handleChat = () => {
    onClose();
    onOpenChat?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={12}>
            <MaterialIcons name="close" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.title}>Como podemos ajudar?</Text>
          <Text style={styles.subtitle}>Escolha uma das opções abaixo para entrar em contato</Text>

          <TouchableOpacity style={styles.optionCard} onPress={handleCall} activeOpacity={0.8}>
            <View style={styles.optionIconCircle}>
              <MaterialIcons name="phone" size={24} color={COLORS.black} />
            </View>
            <Text style={styles.optionLabel}>Ligar para o suporte Take Me</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionCard} onPress={handleChat} activeOpacity={0.8}>
            <View style={styles.optionIconCircle}>
              <MaterialIcons name="headset-mic" size={24} color={COLORS.black} />
            </View>
            <Text style={styles.optionLabel}>Chat com o suporte Take Me</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionCard} onPress={handleWhatsApp} activeOpacity={0.8}>
            <View style={styles.optionIconCircle}>
              <MaterialIcons name="chat" size={24} color={COLORS.black} />
            </View>
            <Text style={styles.optionLabel}>WhatsApp do Take Me</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.footerButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  closeButton: { position: 'absolute', top: 16, right: 16, zIndex: 1 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.neutral700,
    marginBottom: 24,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.yellowLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  optionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.yellowCircle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    flex: 1,
  },
  footerButton: {
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: COLORS.black,
    alignItems: 'center',
  },
  footerButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
