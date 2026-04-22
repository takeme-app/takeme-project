import { useCallback, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripStackParamList } from '../../navigation/types';
import {
  AddressSelectionScreen,
  type SelectedPlaces,
} from '../../components/AddressSelectionScreen';
import { TripResultsList, type TripListFooterMeta } from '../../components/TripResultsList';
import type { WhenTimeResult } from '../../hooks/useWhenTimeSelection';
import type { ClientScheduledTripItem } from '../../lib/clientScheduledTrips';

type Props = NativeStackScreenProps<TripStackParamList, 'PlanTrip'>;

export function PlanTripScreen({ navigation, route }: Props) {
  const placesRef = useRef<SelectedPlaces | null>(null);
  const [tripFooter, setTripFooter] = useState<TripListFooterMeta>({ phase: 'idle' });

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
          ...(when.scheduledTimeSlot ? { scheduledTimeSlot: when.scheduledTimeSlot } : {}),
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
        scheduledTripDepartureAt: trip.departure_at,
      });
    },
    [navigation],
  );

  const renderResults = useCallback(
    (places: SelectedPlaces, when: WhenTimeResult) => {
      placesRef.current = places;
      return (
        <TripResultsList
          places={places}
          when={when}
          onListFooterMetaChange={setTripFooter}
          onScheduleLater={() =>
            navigation.navigate('PlanRide', {
              origin: places.origin,
              destination: places.destination,
            })
          }
        />
      );
    },
    [navigation],
  );

  const continueBottomHidden =
    tripFooter.phase === 'loading' ||
    (tripFooter.phase === 'ready' &&
      tripFooter.error == null &&
      tripFooter.tripCount > 0 &&
      tripFooter.selectedTrip == null);

  const continueBottomLabel =
    tripFooter.phase === 'ready' && tripFooter.tripCount > 0 && tripFooter.selectedTrip != null
      ? 'Continuar para pagamento'
      : 'Seguir sem viagem da lista';

  const onContinuePressOverride =
    tripFooter.phase === 'ready' &&
    tripFooter.tripCount > 0 &&
    tripFooter.selectedTrip != null
      ? () => {
          const p = placesRef.current;
          const trip = tripFooter.selectedTrip;
          if (!p || !trip) return;
          handleSelectTrip(trip, p);
        }
      : undefined;

  return (
    <AddressSelectionScreen
      title="Planeje sua corrida"
      initialDestination={route.params?.initialDestination}
      onConfirm={handleConfirm}
      onGoBack={() => navigation.goBack()}
      showRecentDestinations
      renderResults={renderResults}
      continueBottomLabel={continueBottomLabel}
      continueBottomHidden={continueBottomHidden}
      onContinuePressOverride={onContinuePressOverride}
      whenTitle="Para quando você precisa da viagem?"
      nowSubtitle="Chame um carro imediatamente"
      laterSubtitle="Agende escolhendo o dia"
    />
  );
}
