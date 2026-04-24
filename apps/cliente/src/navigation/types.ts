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
  // Fluxo de envios (guia Serviços)
  ShipmentStack: NavigatorScreenParams<ShipmentStackParamList>;
  // Fluxo de envio de dependentes (Serviços / Início)
  DependentShipmentStack: NavigatorScreenParams<DependentShipmentStackParamList>;
  // Fluxo de excursões (Serviços / Início)
  ExcursionStack: NavigatorScreenParams<ExcursionStackParamList>;
};

export type ExcursionStackParamList = {
  ExcursionRequestForm: undefined;
  ExcursionSuccess: { requestId?: string };
};

/** Origem ou destino de um envio */
export type ShipmentPlaceParam = {
  address: string;
  latitude: number;
  longitude: number;
};

/** Destinatário do envio */
export type ShipmentRecipientParam = {
  name: string;
  email: string;
  phone: string;
  instructions?: string;
  photoUri?: string;
};

export type ShipmentStackParamList = {
  SelectShipmentAddress: undefined;
  Recipient: {
    origin: ShipmentPlaceParam;
    destination: ShipmentPlaceParam;
    whenOption: 'now' | 'later';
    whenLabel?: string;
    packageSize: 'pequeno' | 'medio' | 'grande';
    packageSizeLabel: string;
  };
  ConfirmShipment: {
    origin: ShipmentPlaceParam;
    destination: ShipmentPlaceParam;
    whenOption: 'now' | 'later';
    whenLabel?: string;
    packageSize: 'pequeno' | 'medio' | 'grande';
    packageSizeLabel: string;
    recipient: ShipmentRecipientParam;
    /** Valor total final (já com taxa administrativa quando vier do backend). */
    amountCents: number;
    /** Opcional: quando o backend enviar breakdown, exibir Subtotal + Taxa = Total */
    subtotalCents?: number;
    feeCents?: number;
    orderId?: string;
    shipmentId?: string;
  };
  ShipmentSuccess: {
    orderId: string;
    shipmentId?: string;
    isLargePackage: boolean;
    paymentProcessed: boolean;
  };
};

/** Params do formulário de envio de dependente (nome, contato, bagagens, instruções) */
export type DependentShipmentFormParams = {
  fullName: string;
  contactPhone: string;
  bagsCount: number;
  instructions?: string;
  dependentId?: string;
  photoUri?: string;
};

export type DependentShipmentStackParamList = {
  DependentShipmentForm: undefined;
  AddDependent: undefined;
  DependentSuccess: undefined;
  DefineDependentTrip: DependentShipmentFormParams;
  ConfirmDependentShipment: {
    origin: ShipmentPlaceParam;
    destination: ShipmentPlaceParam;
    whenOption: 'now' | 'later';
    whenLabel?: string;
    fullName: string;
    contactPhone: string;
    bagsCount: number;
    instructions?: string;
    dependentId?: string;
    amountCents: number;
    photoUri?: string;
  };
  DependentShipmentSuccess: {
    orderId: string;
    shipmentId?: string;
  };
};

/** Dados do motorista/viagem selecionada (Procurando viagem → Confirmação → Checkout) */
export type TripDriverParam = {
  /** ID da linha em `scheduled_trips` (histórico: também estava em `id`) */
  id: string;
  driver_id: string;
  name: string;
  rating: number;
  badge: string;
  departure: string;
  arrival: string;
  seats: number;
  bags: number;
  /** Valor em centavos (ex.: 6400 = R$ 64,00) */
  amount_cents?: number;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
  vehicle_plate?: string | null;
  avatar_url?: string | null;
};

/** Ponto de partida ou destino para exibir no mapa (Checkout) */
export type TripPlaceParam = {
  address: string;
  latitude: number;
  longitude: number;
};

/** Passageiro para exibir no Checkout (vem de ConfirmDetails) */
export type TripPassengerParam = { name: string; cpf: string; bags: string };

/** Dados da reserva para exibir em PaymentConfirmed */
export type PaymentConfirmedBookingParam = {
  booking_id: string;
  origin_address: string;
  destination_address: string;
  departure: string;
  arrival: string;
  amount_cents: number;
  driver_name: string;
};

/** Dados exibidos no acompanhamento da viagem após o pagamento */
export type TripLiveDriverDisplay = {
  driverName: string;
  rating: number;
  vehicleLabel: string;
  amountCents: number;
  bookingId?: string;
};

export type TripStackParamList = {
  WhenNeeded: undefined;
  PlanTrip: undefined;
  PlanRide: { origin?: TripPlaceParam; destination?: TripPlaceParam; scheduledDateId?: string; scheduledTimeSlot?: string };
  ChooseTime: undefined;
  SearchTrip: { destination?: { address: string; city?: string; latitude?: number; longitude?: number }; immediateTrip?: boolean };
  ConfirmDetails: { driver?: TripDriverParam; origin?: TripPlaceParam; destination?: TripPlaceParam; scheduled_trip_id?: string; immediateTrip?: boolean };
  Checkout: { driver?: TripDriverParam; origin?: TripPlaceParam; destination?: TripPlaceParam; scheduled_trip_id?: string; passengers?: TripPassengerParam[]; bags_count?: number; immediateTrip?: boolean };
  PaymentConfirmed: {
    booking?: PaymentConfirmedBookingParam;
    immediateTrip?: boolean;
    tripLive?: TripLiveDriverDisplay;
  };
  DriverOnTheWay: TripLiveDriverDisplay | undefined;
  TripInProgress: TripLiveDriverDisplay | undefined;
  RateTrip: { bookingId?: string };
};
