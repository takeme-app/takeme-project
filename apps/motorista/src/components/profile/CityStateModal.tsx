import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../Text';
import { ProfileModalShell } from './ProfileModalShell';
import { GoogleCityAutocomplete } from '../GoogleCityAutocomplete';
import type { GoogleGeocodeResult } from '@take-me/shared';

type Props = {
  visible: boolean;
  onClose: () => void;
  initialCity: string;
  initialState: string;
  onSave: (city: string, stateUf: string) => Promise<void> | void;
};

/**
 * Modal para edição de cidade do motorista.
 *
 * A cidade é buscada via Google Geocoding (mesma API do cadastro). O estado (UF)
 * é preenchido automaticamente a partir do `short_name` do Google — não há campo
 * manual para o motorista digitar o estado.
 */
export function CityStateModal({ visible, onClose, initialCity, initialState, onSave }: Props) {
  const [city, setCity] = useState(initialCity);
  const [uf, setUf] = useState(initialState);
  const [cityResolved, setCityResolved] = useState(Boolean(initialCity.trim()));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setCity(initialCity);
      setUf(initialState);
      setCityResolved(Boolean(initialCity.trim()));
    }
  }, [visible, initialCity, initialState]);

  const handleSelectPlace = (p: GoogleGeocodeResult) => {
    if (p.adminAreaLevel1Code) {
      setUf(p.adminAreaLevel1Code.toUpperCase().slice(0, 2));
    }
  };

  const handleSave = async () => {
    if (!city.trim() || !cityResolved) return;
    setSaving(true);
    try {
      await onSave(city.trim(), uf.trim().toUpperCase().slice(0, 2));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const canSave = Boolean(city.trim()) && cityResolved && !saving;

  return (
    <ProfileModalShell
      visible={visible}
      onClose={onClose}
      title="Atualize sua cidade"
      subtitle="Selecione sua cidade nas sugestões para que o sistema identifique automaticamente o estado."
      primaryLabel="Atualizar"
      onPrimaryPress={handleSave}
      primaryDisabled={!canSave}
    >
      <Text style={styles.label}>Cidade</Text>
      <GoogleCityAutocomplete
        placeholder="Digite sua cidade"
        value={city}
        onChangeText={setCity}
        onSelectPlace={handleSelectPlace}
        onResolutionChange={(resolved) => {
          setCityResolved(resolved);
          if (!resolved) setUf('');
        }}
        cityConfirmed={cityResolved}
        inputStyle={styles.input}
      />
      {uf ? (
        <View style={styles.ufChipRow}>
          <Text style={styles.ufChipLabel}>Estado:</Text>
          <Text style={styles.ufChipValue}>{uf}</Text>
        </View>
      ) : null}
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
    borderWidth: 0,
  },
  ufChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  ufChipLabel: { fontSize: 13, color: '#6B7280' },
  ufChipValue: { fontSize: 14, fontWeight: '700', color: '#111827' },
});
