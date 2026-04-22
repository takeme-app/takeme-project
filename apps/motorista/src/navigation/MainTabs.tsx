import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MainTabParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { PaymentsScreen } from '../screens/PaymentsScreen';
import { ActivitiesScreen } from '../screens/ActivitiesScreen';
import { ProfileStack } from './ProfileStack';
import { useDriverOngoingTripForTabs } from '../hooks/useDriverOngoingTripForTabs';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ACTIVE = '#111827';
const TAB_INACTIVE = '#9CA3AF';
const TAB_BAR_CONTENT_HEIGHT = 56;
const MIN_BOTTOM_INSET = 8;

export function MainTabs() {
  const { hasOngoingTrip } = useDriverOngoingTripForTabs();
  const hasUnreadNotifications = useUnreadNotifications();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, MIN_BOTTOM_INSET);
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + bottomPadding;

  const tabBarVisibleStyle = {
    backgroundColor: '#FFFFFF' as const,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    height: tabBarHeight,
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
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Início',
          tabBarBadge: hasOngoingTrip ? ' ' : undefined,
          tabBarBadgeStyle: hasOngoingTrip
            ? {
                backgroundColor: '#22C55E',
                minWidth: 8,
                maxWidth: 8,
                height: 8,
                borderRadius: 4,
                fontSize: 1,
                lineHeight: 8,
                color: 'transparent',
                paddingHorizontal: 0,
                paddingTop: 0,
                paddingBottom: 0,
              }
            : undefined,
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
        options={({ route }) => {
          const focused = getFocusedRouteNameFromRoute(route) ?? 'Settings';
          const hideTabOnChat = focused === 'Chat';
          return {
            title: 'Perfil',
            tabBarBadge: hasUnreadNotifications ? ' ' : undefined,
            tabBarBadgeStyle: hasUnreadNotifications
              ? {
                  backgroundColor: '#22C55E',
                  minWidth: 8,
                  maxWidth: 8,
                  height: 8,
                  borderRadius: 4,
                  fontSize: 1,
                  lineHeight: 8,
                  color: 'transparent',
                  paddingHorizontal: 0,
                  paddingTop: 0,
                  paddingBottom: 0,
                }
              : undefined,
            tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
              <MaterialIcons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
            ),
            tabBarStyle: hideTabOnChat ? { display: 'none' as const } : tabBarVisibleStyle,
          };
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
