import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from './types';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ProfileOverviewScreen } from '../screens/ProfileOverviewScreen';
import { PersonalInfoScreen } from '../screens/PersonalInfoScreen';
import { WorkerRoutesScreen } from '../screens/WorkerRoutesScreen';
import { WorkerVehiclesScreen } from '../screens/WorkerVehiclesScreen';
import { VehicleDetailScreen } from '../screens/VehicleDetailScreen';
import { VehicleFormScreen } from '../screens/VehicleFormScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { TripScheduleScreen } from '../screens/TripScheduleScreen';
import { RouteScheduleScreen } from '../screens/RouteScheduleScreen';
import { ProfilePlaceholderScreen } from '../screens/ProfilePlaceholderScreen';
import { AboutScreen } from '../screens/AboutScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator
      initialRouteName="Settings"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="ProfileOverview" component={ProfileOverviewScreen} />
      <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
      <Stack.Screen name="WorkerRoutes" component={WorkerRoutesScreen} />
      <Stack.Screen name="WorkerVehicles" component={WorkerVehiclesScreen} />
      <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} />
      <Stack.Screen name="VehicleForm" component={VehicleFormScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Conversations" component={ConversationsScreen} />
      <Stack.Screen name="TripSchedule" component={TripScheduleScreen} />
      <Stack.Screen name="RouteSchedule" component={RouteScheduleScreen} />
      <Stack.Screen name="Placeholder" component={ProfilePlaceholderScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
    </Stack.Navigator>
  );
}
