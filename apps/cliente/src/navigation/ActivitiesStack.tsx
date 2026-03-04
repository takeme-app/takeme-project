import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ActivitiesStackParamList } from './ActivitiesStackTypes';
import { ActivitiesScreen } from '../screens/ActivitiesScreen';
import { TravelHistoryScreen } from '../screens/TravelHistoryScreen';
import { TripDetailScreen } from '../screens/trip/TripDetailScreen';
import { ShipmentDetailScreen } from '../screens/shipment/ShipmentDetailScreen';
import { ShipmentTipScreen } from '../screens/shipment/ShipmentTipScreen';
import { ShipmentRatingScreen } from '../screens/shipment/ShipmentRatingScreen';
import { ChatScreen } from '../screens/ChatScreen';

const Stack = createNativeStackNavigator<ActivitiesStackParamList>();

export function ActivitiesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="ActivitiesList" component={ActivitiesScreen} />
      <Stack.Screen name="TravelHistory" component={TravelHistoryScreen} />
      <Stack.Screen name="TripDetail" component={TripDetailScreen} />
      <Stack.Screen name="ShipmentDetail" component={ShipmentDetailScreen} />
      <Stack.Screen name="ShipmentTip" component={ShipmentTipScreen} />
      <Stack.Screen name="ShipmentRating" component={ShipmentRatingScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}
