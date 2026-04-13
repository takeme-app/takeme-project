import { useCallback } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripStackParamList } from '../../navigation/types';
import {
  AddressSelectionScreen,
  type SelectedPlaces,
} from '../../components/AddressSelectionScreen';
import { TripResultsList } from '../../components/TripResultsList';
import type { WhenTimeResult } from '../../hooks/useWhenTimeSelection';
import type { ClientScheduledTripItem } from '../../lib/clientScheduledTrips';

type Props = NativeStackScreenProps<TripStackParamList, 'PlanTrip'>;

export function PlanTripScreen({ navigation }: Props) {
  const handleConfirm = useCallback(
    (places: SelectedPlaces, when: WhenTimeResult) => {
      if (when.whenOption === 'now') {
        // Com destino confirmado via "Continuar", vai para PlanRide
        navigation.navigate('PlanRide', {
          origin: places.origin,
          destination: places.destination,
        });
      } else {
        navigation.navigate('PlanRide', {
          origin: places.origin,
          destination: places.destination,
          scheduledDateId: when.scheduledDateId,
          scheduledTimeSlot: when.scheduledTimeSlot,
        });
      }
    },
    [navigation],
  );

  const handleSelectTrip = useCallback(
    (trip: ClientScheduledTripItem, places: SelectedPlaces) => {
      navigation.navigate('ConfirmDetails', {
        driver: {
          id: trip.id,
          driver_id: trip.driver_id,
          name: trip.driverName,
          rating: trip.rating,
          badge: trip.badge,
          departure: trip.departure,
          arrival: trip.arrival,
          seats: trip.seats,
          bags: trip.bags,
          amount_cents: trip.amount_cents ?? undefined,
          vehicle_model: trip.vehicle_model,
          vehicle_year: trip.vehicle_year,
          vehicle_plate: trip.vehicle_plate,
          avatar_url: trip.driverAvatarUrl,
        },
        origin: places.origin,
        destination: places.destination,
        scheduled_trip_id: trip.id,
      });
    },
    [navigation],
  );

  const renderResults = useCallback(
    (places: SelectedPlaces) => (
      <TripResultsList
        places={places}
        onSelectTrip={(trip) => handleSelectTrip(trip, places)}
        onScheduleLater={() =>
          navigation.navigate('PlanRide', {
            origin: places.origin,
            destination: places.destination,
          })
        }
      />
    ),
    [handleSelectTrip, navigation],
  );

  return (
    <AddressSelectionScreen
      title="Planeje sua corrida"
      onConfirm={handleConfirm}
      onGoBack={() => navigation.goBack()}
      showRecentDestinations
      renderResults={renderResults}
      continueBottomLabel="Seguir sem viagem da lista"
      whenTitle="Para quando você precisa da viagem?"
      nowSubtitle="Chame um carro imediatamente"
      laterSubtitle="Agende para o horário que preferir"
    />
  );
}
