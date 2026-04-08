import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PagamentosExcursoesScreen } from '../screens/excursoes/PagamentosExcursoesScreen';
import { PagamentosHistoricoExcursoesScreen } from '../screens/excursoes/PagamentosHistoricoExcursoesScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';

export type PagamentosExcStackParamList = {
  PagamentosMain: undefined;
  PagamentosHistorico: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<PagamentosExcStackParamList>();

export function PagamentosExcursoesStack() {
  return (
    <Stack.Navigator
      initialRouteName="PagamentosMain"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="PagamentosMain" component={PagamentosExcursoesScreen} />
      <Stack.Screen name="PagamentosHistorico" component={PagamentosHistoricoExcursoesScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
