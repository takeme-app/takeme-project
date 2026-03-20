import { useState, useEffect } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { Text } from '../Text';
import { ProfileModalShell } from './ProfileModalShell';
import { onlyDigits } from '../../utils/formatCpf';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  label: string;
  initialValue: string;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  onSave: (value: string) => Promise<void> | void;
  /** Guarda só dígitos (idade, telefone, anos). */
  digitsOnly?: boolean;
  /** Ex.: formatPhoneBR para telefone. */
  formatDisplay?: (stored: string) => string;
};

export function SingleFieldModal({
  visible,
  onClose,
  title,
  subtitle,
  label,
  initialValue,
  placeholder,
  keyboardType = 'default',
  onSave,
  digitsOnly,
  formatDisplay,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setValue(digitsOnly ? onlyDigits(initialValue) : initialValue);
  }, [visible, initialValue, digitsOnly]);

  const handleChange = (t: string) => {
    if (digitsOnly) setValue(onlyDigits(t));
    else setValue(t);
  };

  const shown = formatDisplay ? formatDisplay(value) : value;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(value.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProfileModalShell
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      primaryLabel="Atualizar"
      onPrimaryPress={handleSave}
      primaryDisabled={saving}
    >
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={shown}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        autoCorrect={keyboardType === 'email-address' ? false : true}
      />
    </ProfileModalShell>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 8 },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
});
