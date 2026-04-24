import type { ReactNode } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Text } from './Text';

export type UploadFieldProps = {
  label: string;
  labelIcon?: ReactNode;
  labelHint?: string;
  title: string;
  caption?: string;
  selected?: boolean;
  selectedLabel?: string | null;
  onPress: () => void;
};

/**
 * Caixa tracejada de upload usada nos fluxos de cadastro do motorista/preparador.
 * Visual idêntico ao usado no motorista parceiro (`CompleteDriverRegistrationScreen`).
 */
export function UploadField({
  label,
  labelIcon,
  labelHint,
  title,
  caption,
  selected,
  selectedLabel,
  onPress,
}: UploadFieldProps) {
  return (
    <View style={styles.uploadWrap}>
      <View style={styles.uploadLabelRow}>
        {labelIcon ? <View style={styles.uploadLabelIcon}>{labelIcon}</View> : null}
        <Text style={styles.uploadLabelText}>{label}</Text>
      </View>
      {labelHint ? <Text style={styles.uploadLabelHint}>{labelHint}</Text> : null}
      <TouchableOpacity style={styles.uploadBox} onPress={onPress} activeOpacity={0.8}>
        <View style={styles.uploadIconWrap}>
          <MaterialIcons name="cloud-upload" size={26} color="#0D0D0D" />
        </View>
        <View style={styles.uploadTextWrap}>
          <Text style={styles.uploadTitle}>{title}</Text>
          {caption ? <Text style={styles.uploadCaption}>{caption}</Text> : null}
        </View>
        {selected && selectedLabel ? <Text style={styles.uploadOk}>✓ {selectedLabel}</Text> : null}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  uploadWrap: { marginBottom: 8 },
  uploadLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    minHeight: 24,
  },
  uploadLabelIcon: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  uploadLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  uploadLabelHint: {
    fontSize: 12,
    color: '#545454',
    marginBottom: 8,
    marginTop: -4,
  },
  uploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#767676',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 16,
  },
  uploadIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF8E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTextWrap: {
    alignItems: 'center',
    gap: 4,
  },
  uploadTitle: {
    fontSize: 16,
    color: '#767676',
    textAlign: 'center',
    lineHeight: 24,
  },
  uploadCaption: {
    fontSize: 12,
    fontWeight: '600',
    color: '#767676',
    textAlign: 'center',
    lineHeight: 18,
  },
  uploadOk: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    marginTop: -4,
  },
});
