import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ColetasExcursoesScreen } from '../screens/excursoes/ColetasExcursoesScreen';
import { HistoricoExcursoesScreen } from '../screens/excursoes/HistoricoExcursoesScreen';
import { DetalhesExcursaoScreen } from '../screens/excursoes/DetalhesExcursaoScreen';

export type ColetasExcursoesStackParamList = {
  ColetasMain: undefined;
  HistoricoExcursoes: undefined;
  DetalhesExcursao: { excursionId: string };
};

const Stack = createNativeStackNavigator<ColetasExcursoesStackParamList>();

export function ColetasExcursoesStack() {
  return (
    <Stack.Navigator
      initialRouteName="ColetasMain"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="ColetasMain" component={ColetasExcursoesScreen} />
      <Stack.Screen name="HistoricoExcursoes" component={HistoricoExcursoesScreen} />
      <Stack.Screen name="DetalhesExcursao" component={DetalhesExcursaoScreen} />
    </Stack.Navigator>
  );
}
