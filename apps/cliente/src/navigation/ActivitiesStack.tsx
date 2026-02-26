import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ActivitiesStackParamList } from './ActivitiesStackTypes';
import { ActivitiesScreen } from '../screens/ActivitiesScreen';
import { TripDetailScreen } from '../screens/trip/TripDetailScreen';

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
      <Stack.Screen name="TripDetail" component={TripDetailScreen} />
    </Stack.Navigator>
  );
}
