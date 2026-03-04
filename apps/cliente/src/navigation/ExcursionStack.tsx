import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ExcursionStackParamList } from './types';
import { ExcursionRequestFormScreen } from '../screens/excursion/ExcursionRequestFormScreen';
import { ExcursionSuccessScreen } from '../screens/excursion/ExcursionSuccessScreen';

const Stack = createNativeStackNavigator<ExcursionStackParamList>();

export function ExcursionStack() {
  return (
    <Stack.Navigator
      initialRouteName="ExcursionRequestForm"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="ExcursionRequestForm" component={ExcursionRequestFormScreen} />
      <Stack.Screen name="ExcursionSuccess" component={ExcursionSuccessScreen} />
    </Stack.Navigator>
  );
}
