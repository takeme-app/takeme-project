import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
  VerifyEmail: { email: string; password: string; fullName: string; phone: string };
  AddPaymentPrompt: undefined;
  AddPaymentMethod: undefined;
  AddCard: { paymentType: 'credit' | 'debit' };
  CardRegisteredSuccess: undefined;
  Main: undefined;
  ForgotPassword: undefined;
  ForgotPasswordEmailSent: { email: string };
  ResetPassword: undefined;
  ResetPasswordSuccess: undefined;
  TermsOfUse: undefined;
  PrivacyPolicy: undefined;
  // Fluxo de viagens (stack dedicado); aceita tela inicial ao abrir a partir do bottom sheet
  TripStack: NavigatorScreenParams<TripStackParamList>;
};

export type TripStackParamList = {
  WhenNeeded: undefined;
  PlanRide: undefined;
  ChooseTime: undefined;
  SearchTrip: undefined;
  ConfirmDetails: undefined;
  Checkout: undefined;
  PaymentConfirmed: undefined;
  DriverOnTheWay: undefined;
  TripInProgress: undefined;
  RateTrip: undefined;
};
