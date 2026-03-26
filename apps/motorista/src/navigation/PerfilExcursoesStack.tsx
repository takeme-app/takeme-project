import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from './types';
import { PerfilExcursoesScreen } from '../screens/excursoes/PerfilExcursoesScreen';
import { ProfileOverviewScreen } from '../screens/ProfileOverviewScreen';
import { PersonalInfoScreen } from '../screens/PersonalInfoScreen';
import { WorkerVehiclesScreen } from '../screens/WorkerVehiclesScreen';
import { VehicleDetailScreen } from '../screens/VehicleDetailScreen';
import { VehicleFormScreen } from '../screens/VehicleFormScreen';
import { AboutScreen } from '../screens/AboutScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function PerfilExcursoesStack() {
  return (
    <Stack.Navigator
      initialRouteName="Settings"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Settings" component={PerfilExcursoesScreen} />
      <Stack.Screen name="ProfileOverview" component={ProfileOverviewScreen} />
      <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
      <Stack.Screen name="WorkerVehicles" component={WorkerVehiclesScreen} />
      <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} />
      <Stack.Screen name="VehicleForm" component={VehicleFormScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
    </Stack.Navigator>
  );
}
