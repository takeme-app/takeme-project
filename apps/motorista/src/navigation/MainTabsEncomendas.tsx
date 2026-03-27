import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeEncomendasScreen } from '../screens/encomendas/HomeEncomendasScreen';
import { ColetasEncomendasStack } from './ColetasEncomendasStack';
import { ChatEncomendasScreen } from '../screens/encomendas/ChatEncomendasScreen';
import { PagamentosEncomendasScreen } from '../screens/encomendas/PagamentosEncomendasScreen';
import { PerfilEncomendasStack } from './PerfilEncomendasStack';

type EncomendasTabParamList = {
  HomeEnc: undefined;
  ColetasEnc: undefined;
  ChatEnc: undefined;
  PagamentosEnc: undefined;
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

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          height: TAB_BAR_CONTENT_HEIGHT + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 6,
        },
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
        options={{
          title: 'Coletas',
          tabBarIcon: ({ color }) => <MaterialIcons name="inventory-2" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="ChatEnc"
        component={ChatEncomendasScreen}
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <MaterialIcons name="message" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="PagamentosEnc"
        component={PagamentosEncomendasScreen}
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
