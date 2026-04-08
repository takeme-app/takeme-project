import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ProfileStackParamList, ChatExcStackParamList } from './types';
import type { PagamentosExcStackParamList } from './PagamentosExcursoesStack';
import { HomeExcursoesScreen } from '../screens/excursoes/HomeExcursoesScreen';
import { ColetasExcursoesStack } from './ColetasExcursoesStack';
import { ChatExcursoesStack } from './ChatExcursoesStack';
import { PagamentosExcursoesStack } from './PagamentosExcursoesStack';
import { PerfilExcursoesStack } from './PerfilExcursoesStack';

type ExcursoesTabParamList = {
  HomeExc: undefined;
  ColetasExc: undefined;
  ChatExc: NavigatorScreenParams<ChatExcStackParamList>;
  PagamentosExc: NavigatorScreenParams<PagamentosExcStackParamList>;
  PerfilExc: NavigatorScreenParams<ProfileStackParamList>;
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
        component={ColetasExcursoesStack}
        options={{
          title: 'Excursões',
          tabBarIcon: ({ color }) => <MaterialIcons name="directions-bus" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="ChatExc"
        component={ChatExcursoesStack}
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <MaterialIcons name="message" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="PagamentosExc"
        component={PagamentosExcursoesStack}
        options={{
          title: 'Pagamentos',
          tabBarIcon: ({ color }) => <MaterialIcons name="payments" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="PerfilExc"
        component={PerfilExcursoesStack}
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('PerfilExc', { screen: 'Settings' });
          },
        })}
      />
    </Tab.Navigator>
  );
}
