import { useRef } from 'react';
import { NavigationContainer, type NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthRecoveryHandler } from './AuthRecoveryHandler';
import { SplashScreen } from '../screens/SplashScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { VerifyEmailScreen } from '../screens/VerifyEmailScreen';
import { AddPaymentPromptScreen } from '../screens/AddPaymentPromptScreen';
import { AddPaymentMethodScreen } from '../screens/AddPaymentMethodScreen';
import { AddCardScreen } from '../screens/AddCardScreen';
import { CardRegisteredSuccessScreen } from '../screens/CardRegisteredSuccessScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { ForgotPasswordEmailSentScreen } from '../screens/ForgotPasswordEmailSentScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { ResetPasswordSuccessScreen } from '../screens/ResetPasswordSuccessScreen';
import { TermsOfUseScreen } from '../screens/TermsOfUseScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { MainTabs } from './MainTabs';
import { TripStack } from './TripStack';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  return (
    <NavigationContainer ref={navigationRef}>
      <AuthRecoveryHandler navigationRef={navigationRef} />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        <Stack.Screen name="AddPaymentPrompt" component={AddPaymentPromptScreen} />
        <Stack.Screen name="AddPaymentMethod" component={AddPaymentMethodScreen} />
        <Stack.Screen name="AddCard" component={AddCardScreen} />
        <Stack.Screen
          name="CardRegisteredSuccess"
          component={CardRegisteredSuccessScreen}
        />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="TripStack" component={TripStack} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen
          name="ForgotPasswordEmailSent"
          component={ForgotPasswordEmailSentScreen}
        />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen
          name="ResetPasswordSuccess"
          component={ResetPasswordSuccessScreen}
        />
        <Stack.Screen name="TermsOfUse" component={TermsOfUseScreen} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
