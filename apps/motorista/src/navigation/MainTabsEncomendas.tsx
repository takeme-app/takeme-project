import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeEncomendasScreen } from '../screens/encomendas/HomeEncomendasScreen';
import { ColetasEncomendasStack } from './ColetasEncomendasStack';
import { ChatEncomendasStack } from './ChatEncomendasStack';
import { PagamentosEncomendasStack } from './PagamentosEncomendasStack';
import { PerfilEncomendasStack } from './PerfilEncomendasStack';
import type { ChatEncomendasStackParamList, PagamentosEncStackParamList } from './types';

type EncomendasTabParamList = {
  HomeEnc: undefined;
  ColetasEnc: undefined;
  ChatEnc: NavigatorScreenParams<ChatEncomendasStackParamList>;
  PagamentosEnc: NavigatorScreenParams<PagamentosEncStackParamList>;
  PerfilEnc: undefined;
};

const Tab = createBottomTabNavigator<EncomendasTabParamList>();

const TAB_ACTIVE = '#111827';
const TAB_INACTIVE = '#9CA3AF';
const TAB_BAR_CONTENT_HEIGHT = 56;
const MIN_BOTTOM_INSET = 8;

export function MainTabsEncomendas() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, MIN_BOTTOM_INSET);

  const tabBarVisibleStyle = {
    backgroundColor: '#FFFFFF' as const,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    height: TAB_BAR_CONTENT_HEIGHT + bottomPadding,
    paddingBottom: bottomPadding,
    paddingTop: 6,
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: tabBarVisibleStyle,
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      <Tab.Screen
        name="HomeEnc"
        component={HomeEncomendasScreen}
        options={{
          title: 'Início',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="home" size={24} color={color} style={{ opacity: focused ? 1 : 0.9 }} />
          ),
        }}
      />
      <Tab.Screen
        name="ColetasEnc"
        component={ColetasEncomendasStack}
        options={({ route }) => {
          const focused = getFocusedRouteNameFromRoute(route) ?? 'ColetasMain';
          const hideTabOnMap = focused === 'ActiveShipment' || focused === 'DetalhesEncomenda';
          return {
            title: 'Coletas',
            tabBarIcon: ({ color }: { color: string }) => (
              <MaterialIcons name="inventory-2" size={24} color={color} />
            ),
            tabBarStyle: hideTabOnMap ? { display: 'none' as const } : tabBarVisibleStyle,
          };
        }}
      />
      <Tab.Screen
        name="ChatEnc"
        component={ChatEncomendasStack}
        options={({ route }) => {
          const focused = getFocusedRouteNameFromRoute(route) ?? 'ChatEncList';
          const hideTabOnChatThread = focused === 'ChatEncThread';
          return {
            title: 'Chat',
            tabBarIcon: ({ color }: { color: string }) => (
              <MaterialIcons name="message" size={24} color={color} />
            ),
            tabBarStyle: hideTabOnChatThread ? { display: 'none' as const } : tabBarVisibleStyle,
          };
        }}
      />
      <Tab.Screen
        name="PagamentosEnc"
        component={PagamentosEncomendasStack}
        options={{
          title: 'Pagamentos',
          tabBarIcon: ({ color }) => <MaterialIcons name="payments" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="PerfilEnc"
        component={PerfilEncomendasStack}
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
