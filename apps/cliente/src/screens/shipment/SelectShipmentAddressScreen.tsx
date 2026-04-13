import { useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ShipmentStackParamList } from '../../navigation/types';
import {
  AddressSelectionScreen,
  type SelectedPlaces,
} from '../../components/AddressSelectionScreen';
import { PackageSizeSheet, type PackageSize } from '../../components/PackageSizeSheet';
import type { WhenTimeResult } from '../../hooks/useWhenTimeSelection';

type Props = NativeStackScreenProps<ShipmentStackParamList, 'SelectShipmentAddress'>;

const COLORS = {
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
};

export function SelectShipmentAddressScreen({ navigation }: Props) {
  const [packageSize, setPackageSize] = useState<PackageSize>('medio');
  const [packageSizeLabel, setPackageSizeLabel] = useState('Médio');
  const [sizeSheetVisible, setSizeSheetVisible] = useState(false);

  const handleConfirm = useCallback(
    (places: SelectedPlaces, when: WhenTimeResult) => {
      navigation.navigate('Recipient', {
        origin: {
          address: places.origin.address,
          latitude: places.origin.latitude,
          longitude: places.origin.longitude,
          ...(places.origin.city ? { city: places.origin.city } : {}),
        },
        destination: {
          address: places.destination.address,
          latitude: places.destination.latitude,
          longitude: places.destination.longitude,
        },
        whenOption: when.whenOption,
        whenLabel: when.whenLabel,
        packageSize,
        packageSizeLabel,
      });
    },
    [navigation, packageSize, packageSizeLabel],
  );

  const renderExtraPills = useCallback(
    () => (
      <TouchableOpacity
        style={styles.pill}
        onPress={() => setSizeSheetVisible(true)}
        activeOpacity={0.8}
      >
        <MaterialIcons name="inventory-2" size={18} color={COLORS.black} />
        <Text style={styles.pillText}>{packageSizeLabel}</Text>
        <MaterialIcons name="keyboard-arrow-down" size={18} color={COLORS.black} />
      </TouchableOpacity>
    ),
    [packageSizeLabel],
  );

  return (
    <>
      <AddressSelectionScreen
        title="Para onde?"
        onConfirm={handleConfirm}
        onGoBack={() => navigation.goBack()}
        extractOriginCity
        showRecentDestinations
        renderExtraPills={renderExtraPills}
        destinationPlaceholder="Destino do envio"
        whenTitle="Para quando é o envio?"
        nowSubtitle="Envio imediato"
        laterSubtitle="Agende para o horário que preferir"
      />
      <PackageSizeSheet
        visible={sizeSheetVisible}
        onClose={() => setSizeSheetVisible(false)}
        selectedSize={packageSize}
        onSelectSize={(size, label) => {
          setPackageSize(size);
          setPackageSizeLabel(label);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.neutral300,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    gap: 6,
  },
  pillText: { fontSize: 14, fontWeight: '500', color: COLORS.black },
});
