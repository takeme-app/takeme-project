import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from './ProfileStackTypes';
import { ProfileScreen } from '../screens/ProfileScreen';
import { PersonalInfoScreen } from '../screens/profile/PersonalInfoScreen';
import { WalletScreen } from '../screens/profile/WalletScreen';
import { AboutScreen } from '../screens/profile/AboutScreen';
import { NotificationsScreen } from '../screens/profile/NotificationsScreen';
import { ConfigureNotificationsScreen } from '../screens/profile/ConfigureNotificationsScreen';
import { DependentsScreen } from '../screens/profile/DependentsScreen';
import { DependentDetailScreen } from '../screens/profile/DependentDetailScreen';
import { AddDependentScreen } from '../screens/profile/AddDependentScreen';
import { DependentSuccessScreen } from '../screens/profile/DependentSuccessScreen';
import { ConversationsScreen } from '../screens/profile/ConversationsScreen';
import { AddPaymentMethodScreen } from '../screens/AddPaymentMethodScreen';
import { AddCardScreen } from '../screens/AddCardScreen';
import { ProfileCardRegisteredSuccessScreen } from '../screens/profile/ProfileCardRegisteredSuccessScreen';
import { TermsOfUseScreen } from '../screens/TermsOfUseScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { CancellationPolicyScreen } from '../screens/CancellationPolicyScreen';
import { EditNameScreen } from '../screens/profile/EditNameScreen';
import { EditEmailScreen } from '../screens/profile/EditEmailScreen';
import { EditPhoneScreen } from '../screens/profile/EditPhoneScreen';
import { EditCpfScreen } from '../screens/profile/EditCpfScreen';
import { EditLocationScreen } from '../screens/profile/EditLocationScreen';
import { ChangePasswordScreen } from '../screens/profile/ChangePasswordScreen';
import { EditAvatarScreen } from '../screens/profile/EditAvatarScreen';
import { DeleteAccountStep1Screen } from '../screens/profile/DeleteAccountStep1Screen';
import { DeleteAccountStep2Screen } from '../screens/profile/DeleteAccountStep2Screen';
import { DeleteDependentScreen } from '../screens/profile/DeleteDependentScreen';
import { DeleteCardScreen } from '../screens/profile/DeleteCardScreen';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

function AddPaymentMethodWrapper(props: NativeStackScreenProps<ProfileStackParamList, 'AddPaymentMethod'>) {
  return <AddPaymentMethodScreen {...(props as any)} />;
}
function AddCardWrapper(props: NativeStackScreenProps<ProfileStackParamList, 'AddCard'>) {
  return <AddCardScreen {...(props as any)} />;
}
function TermsOfUseWrapper(props: NativeStackScreenProps<ProfileStackParamList, 'TermsOfUse'>) {
  return <TermsOfUseScreen {...(props as any)} />;
}
function PrivacyPolicyWrapper(props: NativeStackScreenProps<ProfileStackParamList, 'PrivacyPolicy'>) {
  return <PrivacyPolicyScreen {...(props as any)} />;
}

export function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="ConfigureNotifications" component={ConfigureNotificationsScreen} />
      <Stack.Screen name="Dependents" component={DependentsScreen} />
      <Stack.Screen name="DependentDetail" component={DependentDetailScreen} />
      <Stack.Screen name="AddDependent" component={AddDependentScreen} />
      <Stack.Screen name="DependentSuccess" component={DependentSuccessScreen} />
      <Stack.Screen name="Conversations" component={ConversationsScreen} />
      <Stack.Screen name="AddPaymentMethod" component={AddPaymentMethodWrapper} />
      <Stack.Screen name="AddCard" component={AddCardWrapper} />
      <Stack.Screen name="CardRegisteredSuccess" component={ProfileCardRegisteredSuccessScreen} />
      <Stack.Screen name="TermsOfUse" component={TermsOfUseWrapper} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyWrapper} />
      <Stack.Screen name="CancellationPolicy" component={CancellationPolicyScreen} />
      <Stack.Screen
        name="EditName"
        component={EditNameScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="EditEmail"
        component={EditEmailScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="EditPhone"
        component={EditPhoneScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="EditCpf"
        component={EditCpfScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="EditLocation"
        component={EditLocationScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="EditAvatar"
        component={EditAvatarScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="DeleteAccountStep1"
        component={DeleteAccountStep1Screen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="DeleteAccountStep2"
        component={DeleteAccountStep2Screen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="DeleteDependent"
        component={DeleteDependentScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="DeleteCard"
        component={DeleteCardScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
