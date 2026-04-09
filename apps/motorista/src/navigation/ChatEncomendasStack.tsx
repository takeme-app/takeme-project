import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ChatEncomendasStackParamList } from './types';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { ChatScreen } from '../screens/ChatScreen';

const Stack = createNativeStackNavigator<ChatEncomendasStackParamList>();

export function ChatEncomendasStack() {
  return (
    <Stack.Navigator
      initialRouteName="ChatEncList"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="ChatEncList"
        component={ConversationsScreen}
        initialParams={{ hideBack: true, chatScreenName: 'ChatEncThread' }}
      />
      <Stack.Screen name="ChatEncThread" component={ChatScreen} />
    </Stack.Navigator>
  );
}
