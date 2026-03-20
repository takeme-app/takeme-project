import { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Text } from '../Text';
import { ProfileModalShell } from './ProfileModalShell';

type Props = {
  visible: boolean;
  onClose: () => void;
  initialCity: string;
  initialState: string;
  onSave: (city: string, stateUf: string) => Promise<void> | void;
};

export function CityStateModal({ visible, onClose, initialCity, initialState, onSave }: Props) {
  const [city, setCity] = useState(initialCity);
  const [uf, setUf] = useState(initialState);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setCity(initialCity);
      setUf(initialState);
    }
  }, [visible, initialCity, initialState]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(city.trim(), uf.trim().toUpperCase().slice(0, 2));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProfileModalShell
      visible={visible}
      onClose={onClose}
      title="Atualize sua cidade"
      subtitle="Informe a cidade e o estado onde você atua como motorista. Isso ajuda a definir suas rotas e preferências de viagem."
      primaryLabel="Atualizar"
      onPrimaryPress={handleSave}
      primaryDisabled={saving}
    >
      <Text style={styles.label}>Cidade</Text>
      <TextInput
        style={styles.input}
        value={city}
        onChangeText={setCity}
        placeholder="Ex: São Paulo"
        placeholderTextColor="#9CA3AF"
      />
      <View style={{ height: 16 }} />
      <Text style={styles.label}>Estado</Text>
      <TextInput
        style={styles.input}
        value={uf}
        onChangeText={(t) => setUf(t.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
        placeholder="Ex: SP"
        placeholderTextColor="#9CA3AF"
        maxLength={2}
        autoCapitalize="characters"
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
