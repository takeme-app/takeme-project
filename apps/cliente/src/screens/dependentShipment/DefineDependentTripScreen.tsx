import { useCallback } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DependentShipmentStackParamList, ShipmentPlaceParam } from '../../navigation/types';
import {
  AddressSelectionScreen,
  type SelectedPlaces,
} from '../../components/AddressSelectionScreen';
import type { WhenTimeResult } from '../../hooks/useWhenTimeSelection';

/** Valor placeholder em centavos para envio de dependente (ex.: R$ 50,00). */
const PLACEHOLDER_AMOUNT_CENTS = 5000;

type Props = NativeStackScreenProps<DependentShipmentStackParamList, 'DefineDependentTrip'>;

export function DefineDependentTripScreen({ navigation, route }: Props) {
  const { fullName, contactPhone, bagsCount, instructions, dependentId, photoUri } = route.params;

  const handleConfirm = useCallback(
    (places: SelectedPlaces, when: WhenTimeResult) => {
      const origin: ShipmentPlaceParam = {
        address: places.origin.address,
        latitude: places.origin.latitude,
        longitude: places.origin.longitude,
      };
      const destination: ShipmentPlaceParam = {
        address: places.destination.address,
        latitude: places.destination.latitude,
        longitude: places.destination.longitude,
      };
      navigation.navigate('ConfirmDependentShipment', {
        origin,
        destination,
        whenOption: when.whenOption,
        whenLabel: when.whenLabel,
        fullName,
        contactPhone,
        bagsCount,
        instructions,
        dependentId,
        amountCents: PLACEHOLDER_AMOUNT_CENTS,
        photoUri,
      });
    },
    [navigation, fullName, contactPhone, bagsCount, instructions, dependentId, photoUri],
  );

  return (
    <AddressSelectionScreen
      title="Definir viagem"
      onConfirm={handleConfirm}
      onGoBack={() => navigation.goBack()}
      showRecentDestinations={false}
      destinationPlaceholder="Para onde vai o dependente?"
      whenTitle="Para quando é a viagem?"
      nowSubtitle="Solicitar imediatamente"
      laterSubtitle="Agende para o horário que preferir"
    />
  );
}
