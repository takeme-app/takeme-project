import type { NavigatorScreenParams } from '@react-navigation/native';

export type DriverType = 'take_me' | 'parceiro';

export type ProfileStackParamList = {
  /** Grid Configurações (aba Perfil). */
  Settings: undefined;
  /** Resumo + sair (card Perfil). */
  ProfileOverview: undefined;
  PersonalInfo: undefined;
  WorkerRoutes: undefined;
  WorkerVehicles: { successMessage?: string } | undefined;
  VehicleDetail: { vehicleId: string };
  VehicleForm: { vehicleId?: string };
  Notifications: undefined;
  Conversations: undefined;
  TripSchedule: undefined;
  RouteSchedule: { routeId: string; routeName: string };
  /** Tela genérica de placeholder. */
  Placeholder: { title: string; subtitle?: string };
  About: undefined;
};

/** Abas principais (navbar inferior). */
export type MainTabParamList = {
  Home: undefined;
  Payments: undefined;
  Activities: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

/** Tipo de cadastro na tela "Crie sua conta" (igual ao layout: Motorista + Preparador). */
export type RegistrationType = DriverType | 'preparador_excursões' | 'preparador_encomendas';

export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  SignUpType: undefined;
  Login: undefined;
  SignUp: { registrationType?: RegistrationType };
  VerifyEmail: {
    email: string;
    password: string;
    fullName?: string;
    phone?: string;
    registrationType?: RegistrationType;
  };
  /** Cadastro completo do motorista; e-mail/senha/token ficam em DeferredDriverSignupContext. */
  CompleteDriverRegistration: { driverType: DriverType };
  /** Cria auth + worker_profiles + vehicles + routes (último passo do cadastro). */
  FinalizeRegistration: { driverType: DriverType };
  RegistrationSuccess: undefined;
  /** Sessão ativa mas worker_profiles.status !== approved (ex.: inactive). */
  MotoristaPendingApproval: undefined;
  Main: undefined;
  PendingRequests: undefined;
  TripHistory: undefined;
  TripDetail: { tripId: string };
  ActiveTrip: { tripId: string };
  ForgotPassword: undefined;
  ForgotPasswordEmailSent: { email: string };
  ResetPassword: undefined;
  ResetPasswordSuccess: undefined;
  TermsOfUse: undefined;
  PrivacyPolicy: undefined;
};
