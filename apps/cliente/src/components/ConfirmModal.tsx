import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral700: '#767676',
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  secondaryDanger?: boolean;
  /** Se definido, o botão secundário chama onSecondary em vez de onClose */
  onSecondary?: () => void;
};

export function ConfirmModal({
  visible,
  onClose,
  title,
  subtitle,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  secondaryDanger = true,
  onSecondary,
}: Props) {
  const handleSecondary = () => (onSecondary ? onSecondary() : onClose());
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <TouchableOpacity style={styles.primary} activeOpacity={0.8} onPress={onPrimary}>
            <Text style={styles.primaryText}>{primaryLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} activeOpacity={0.8} onPress={handleSecondary}>
            <Text style={[styles.secondaryText, secondaryDanger && styles.secondaryTextDanger]}>{secondaryLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  box: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.neutral700,
    textAlign: 'center',
    marginBottom: 24,
  },
  primary: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: COLORS.black,
    alignItems: 'center',
  },
  primaryText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  secondary: { marginTop: 12, paddingVertical: 14, alignItems: 'center' },
  secondaryText: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  secondaryTextDanger: { color: '#dc2626' },
});
