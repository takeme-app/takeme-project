import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ChatExcStackParamList } from './types';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { ChatScreen } from '../screens/ChatScreen';

const Stack = createNativeStackNavigator<ChatExcStackParamList>();

export function ChatExcursoesStack() {
  return (
    <Stack.Navigator
      initialRouteName="ChatExcList"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="ChatExcList"
        component={ConversationsScreen}
        initialParams={{ hideBack: true, chatScreenName: 'ChatExcThread' }}
      />
      <Stack.Screen name="ChatExcThread" component={ChatScreen} />
    </Stack.Navigator>
  );
}
