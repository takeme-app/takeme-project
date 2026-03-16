export type DriverType = 'take_me' | 'parceiro';

export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  SignUpType: undefined;
  Login: undefined;
  SignUp: { driverType?: DriverType };
  VerifyEmail: { email: string; password: string; fullName: string; phone: string; driverType?: DriverType };
  CompleteDriverRegistration: { driverType: DriverType };
  RegistrationSuccess: undefined;
  Main: undefined;
  ForgotPassword: undefined;
  ForgotPasswordEmailSent: { email: string };
  ResetPassword: undefined;
  ResetPasswordSuccess: undefined;
  TermsOfUse: undefined;
  PrivacyPolicy: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
  PersonalInfo: undefined;
};
