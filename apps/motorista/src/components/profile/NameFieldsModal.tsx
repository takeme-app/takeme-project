import { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Text } from '../Text';
import { ProfileModalShell } from './ProfileModalShell';

type Props = {
  visible: boolean;
  onClose: () => void;
  initialFirst: string;
  initialLast: string;
  onSave: (first: string, last: string) => Promise<void> | void;
};

export function NameFieldsModal({ visible, onClose, initialFirst, initialLast, onSave }: Props) {
  const [first, setFirst] = useState(initialFirst);
  const [last, setLast] = useState(initialLast);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setFirst(initialFirst);
      setLast(initialLast);
    }
  }, [visible, initialFirst, initialLast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(first.trim(), last.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProfileModalShell
      visible={visible}
      onClose={onClose}
      title="Atualize seu nome"
      subtitle="Esse nome será exibido para motoristas e parceiros nos serviços da plataforma."
      primaryLabel="Atualizar"
      onPrimaryPress={handleSave}
      primaryDisabled={saving}
    >
      <Text style={styles.label}>Primeiro nome</Text>
      <TextInput
        style={styles.input}
        value={first}
        onChangeText={setFirst}
        placeholder="Primeiro nome"
        placeholderTextColor="#9CA3AF"
      />
      <View style={{ height: 16 }} />
      <Text style={styles.label}>Último nome</Text>
      <TextInput
        style={styles.input}
        value={last}
        onChangeText={setLast}
        placeholder="Sobrenome"
        placeholderTextColor="#9CA3AF"
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
