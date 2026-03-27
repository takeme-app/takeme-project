import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeExcursoesScreen } from '../screens/excursoes/HomeExcursoesScreen';
import { ColetasExcursoesScreen } from '../screens/excursoes/ColetasExcursoesScreen';
import { ChatExcursoesScreen } from '../screens/excursoes/ChatExcursoesScreen';
import { PagamentosExcursoesScreen } from '../screens/excursoes/PagamentosExcursoesScreen';
import { PerfilExcursoesScreen } from '../screens/excursoes/PerfilExcursoesScreen';

type ExcursoesTabParamList = {
  HomeExc: undefined;
  ColetasExc: undefined;
  ChatExc: undefined;
  PagamentosExc: undefined;
  PerfilExc: undefined;
};

const Tab = createBottomTabNavigator<ExcursoesTabParamList>();

const TAB_ACTIVE = '#111827';
const TAB_INACTIVE = '#9CA3AF';
const TAB_BAR_CONTENT_HEIGHT = 56;
const MIN_BOTTOM_INSET = 8;

export function MainTabsExcursoes() {
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
        name="HomeExc"
        component={HomeExcursoesScreen}
        options={{
          title: 'Início',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="home" size={24} color={color} style={{ opacity: focused ? 1 : 0.9 }} />
          ),
        }}
      />
      <Tab.Screen
        name="ColetasExc"
        component={ColetasExcursoesScreen}
        options={{
          title: 'Excursões',
          tabBarIcon: ({ color }) => <MaterialIcons name="directions-bus" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="ChatExc"
        component={ChatExcursoesScreen}
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <MaterialIcons name="message" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="PagamentosExc"
        component={PagamentosExcursoesScreen}
        options={{
          title: 'Pagamentos',
          tabBarIcon: ({ color }) => <MaterialIcons name="payments" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="PerfilExc"
        component={PerfilExcursoesScreen}
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
