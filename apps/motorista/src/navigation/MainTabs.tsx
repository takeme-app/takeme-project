import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MainTabParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { PaymentsScreen } from '../screens/PaymentsScreen';
import { ActivitiesScreen } from '../screens/ActivitiesScreen';
import { ProfileStack } from './ProfileStack';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ACTIVE = '#111827';
const TAB_INACTIVE = '#9CA3AF';
const TAB_BAR_CONTENT_HEIGHT = 56;
const MIN_BOTTOM_INSET = 8;

export function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, MIN_BOTTOM_INSET);
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + bottomPadding;

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
          height: tabBarHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
        },
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Início',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="home" size={24} color={color} style={{ opacity: focused ? 1 : 0.9 }} />
          ),
        }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentsScreen}
        options={{
          title: 'Pagamentos',
          tabBarIcon: ({ color }) => <MaterialIcons name="attach-money" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Activities"
        component={ActivitiesScreen}
        options={{
          title: 'Atividades',
          tabBarIcon: ({ color }) => <MaterialIcons name="description" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('Profile', { screen: 'Settings' });
          },
        })}
      />
    </Tab.Navigator>
  );
}
