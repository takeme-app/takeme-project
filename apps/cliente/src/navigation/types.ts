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
  ForgotPasswordVerifyCode: { email: string };
  ResetPassword: { passwordResetToken?: string };
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
  /** Cidade da origem (filtro no app motorista). */
  city?: string;
};

/** Origem, destino, janela e tamanho do pacote (sem cotação nem destinatário). */
export type ShipmentLegParams = {
  origin: ShipmentPlaceParam;
  destination: ShipmentPlaceParam;
  whenOption: 'now' | 'later';
  whenLabel?: string;
  packageSize: 'pequeno' | 'medio' | 'grande';
  packageSizeLabel: string;
};

/** Valores da cotação e base após calcular o preço. */
export type ShipmentPricingQuoteParams = {
  amountCents: number;
  pricingSubtotalCents: number;
  platformFeeCents: number;
  priceRouteBaseCents: number;
  pricingRouteId: string;
  adminPctApplied: number;
  /** Base de hub na origem (`null` = sem base na região). */
  resolvedBaseId?: string | null;
};

/** Após escolher o motorista: cotação + motorista; o destinatário é preenchido na tela seguinte. */
export type ShipmentAfterDriverParams = ShipmentLegParams &
  ShipmentPricingQuoteParams & {
    clientPreferredDriverId: string;
    scheduledTripDepartureAt?: string;
    /** `scheduled_trips.id` da oferta escolhida (grava em `shipments.scheduled_trip_id`). */
    scheduledTripId?: string;
  };

/** Dados comuns: destinatário + cotação (checkout). */
export type ShipmentRecipientQuoteParams = ShipmentLegParams &
  ShipmentPricingQuoteParams & {
    recipient: ShipmentRecipientParam;
    /** Dia da viagem do motorista escolhido (para limite mesmo destino / mesmo dia). */
    scheduledTripDepartureAt?: string;
    scheduledTripId?: string;
  };

/** Destinatário do envio */
export type ShipmentRecipientParam = {
  name: string;
  /** Opcional: no insert usa e-mail da conta quando ausente (DB exige recipient_email). */
  email?: string;
  phone: string;
  instructions?: string;
  /** @deprecated Preferir `photoUris`. */
  photoUri?: string;
  /** Paths locais (file://) antes do upload; múltiplas fotos da encomenda. */
  photoUris?: string[];
};

export type ShipmentStackParamList = {
  SelectShipmentAddress: undefined;
  SelectShipmentDriver: ShipmentLegParams;
  Recipient: ShipmentAfterDriverParams;
  ConfirmShipment: ShipmentRecipientQuoteParams & {
    /**
     * Motorista de viagem escolhido pelo cliente (oferta em `shipments`; `base_id` pode existir para coleta na base).
     * Ausente no fluxo “só hub” / continuar sem motorista de rota.
     */
    clientPreferredDriverId?: string;
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

/** Params do formulário de envio de dependente (nome, contato, bagagens, instruções) */
export type DependentShipmentFormParams = {
  fullName: string;
  contactPhone: string;
  bagsCount: number;
  instructions?: string;
  dependentId?: string;
  /** @deprecated Preferir `photoUris`. */
  photoUri?: string;
  photoUris?: string[];
};

/** Origem, destino e janela após «Definir viagem» (antes de escolher motorista). */
export type DependentTripLegParams = DependentShipmentFormParams & {
  origin: ShipmentPlaceParam;
  destination: ShipmentPlaceParam;
  whenOption: 'now' | 'later';
  whenLabel?: string;
};

export type DependentShipmentStackParamList = {
  DependentShipmentForm: undefined;
  AddDependent: undefined;
  DependentSuccess: undefined;
  DefineDependentTrip: DependentShipmentFormParams;
  SelectDependentTripDriver: DependentTripLegParams;
  ConfirmDependentShipment: DependentTripLegParams & {
    driver: TripDriverParam;
    amountCents: number;
    /** `scheduled_trips.departure_at` (ISO) para `dependent_shipments.scheduled_at`. */
    scheduledTripDepartureAt: string;
  };
  DependentShipmentSuccess: {
    orderId: string;
    shipmentId?: string;
  };
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
  /** Permite buscar códigos e paradas sem depender só do refetch */
  scheduledTripId?: string;
  origin?: { latitude: number; longitude: number; address?: string };
  destination?: { latitude: number; longitude: number; address?: string };
  /** Mapa em ecrã completo (ex.: «Acompanhar em tempo real» nos detalhes). */
  mapFocused?: boolean;
};

export type TripStackParamList = {
  WhenNeeded: undefined;
  /** `initialDestination`: abre o mesmo ecrã que «Viagens» com destino já escolhido (ex.: destinos recentes na home). */
  PlanTrip: {
    initialDestination?: { address: string; city?: string; latitude?: number; longitude?: number };
  };
  PlanRide: { origin?: TripPlaceParam; destination?: TripPlaceParam; scheduledDateId?: string; scheduledTimeSlot?: string };
  ChooseTime: undefined;
  SearchTrip: { destination?: { address: string; city?: string; latitude?: number; longitude?: number }; immediateTrip?: boolean };
  ConfirmDetails: {
    driver?: TripDriverParam;
    origin?: TripPlaceParam;
    destination?: TripPlaceParam;
    scheduled_trip_id?: string;
    immediateTrip?: boolean;
    /** ISO da partida da `scheduled_trip` (limite mesmo destino / mesmo dia). */
    scheduledTripDepartureAt?: string;
  };
  Checkout: {
    driver?: TripDriverParam;
    origin?: TripPlaceParam;
    destination?: TripPlaceParam;
    scheduled_trip_id?: string;
    passengers?: TripPassengerParam[];
    bags_count?: number;
    immediateTrip?: boolean;
    scheduledTripDepartureAt?: string;
  };
  PaymentConfirmed: {
    booking?: PaymentConfirmedBookingParam;
    immediateTrip?: boolean;
    tripLive?: TripLiveDriverDisplay;
    /** Quando `dinheiro`, textos da tela falam em pagamento no ato, não “já pago”. */
    paymentMethod?: 'credito' | 'debito' | 'pix' | 'dinheiro';
  };
  DriverOnTheWay: TripLiveDriverDisplay | undefined;
  TripInProgress: TripLiveDriverDisplay | undefined;
  RateTrip: { bookingId?: string; initialRating?: number };
};

/** Telas de acompanhamento reutilizadas no stack de Atividades e no fluxo TripStack. */
export type TripFollowStackParamList = Pick<
  TripStackParamList,
  'DriverOnTheWay' | 'TripInProgress' | 'RateTrip'
>;
