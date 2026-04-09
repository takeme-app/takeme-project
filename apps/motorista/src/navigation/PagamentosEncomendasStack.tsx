import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PagamentosEncStackParamList } from './types';
import { PagamentosEncomendasScreen } from '../screens/encomendas/PagamentosEncomendasScreen';
import { PagamentosHistoricoEncomendasScreen } from '../screens/encomendas/PagamentosHistoricoEncomendasScreen';

const Stack = createNativeStackNavigator<PagamentosEncStackParamList>();

export function PagamentosEncomendasStack() {
  return (
    <Stack.Navigator
      initialRouteName="PagamentosMain"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="PagamentosMain" component={PagamentosEncomendasScreen} />
      <Stack.Screen name="PagamentosHistorico" component={PagamentosHistoricoEncomendasScreen} />
    </Stack.Navigator>
  );
}
