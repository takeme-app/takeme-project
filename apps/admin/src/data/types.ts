export type TripStatus = 'active' | 'cancelled' | 'completed';
export type BookingStatus = 'pending' | 'confirmed' | 'paid' | 'cancelled';
export type ShipmentStatus = 'pending_review' | 'confirmed' | 'in_progress' | 'delivered' | 'cancelled';
export type ExcursionStatus = 'pending' | 'contacted' | 'quoted' | 'cancelled' | 'in_analysis' | 'approved' | 'scheduled' | 'in_progress' | 'completed';

export interface ProfileRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  cpf: string | null;
  city: string | null;
  state: string | null;
  rating: number | null;
  verified: boolean;
  created_at: string;
}

export interface ScheduledTripRow {
  id: string;
  driver_id: string;
  origin_address: string;
  destination_address: string;
  departure_at: string;
  arrival_at: string;
  seats_available: number;
  bags_available: number;
  badge: string | null;
  amount_cents: number | null;
  status: TripStatus;
  created_at: string;
}

export interface BookingRow {
  id: string;
  user_id: string;
  scheduled_trip_id: string;
  origin_address: string;
  destination_address: string;
  passenger_count: number;
  bags_count: number;
  passenger_data: Array<{ name?: string; cpf?: string; bags?: number }>;
  amount_cents: number;
  status: BookingStatus;
  created_at: string;
}

export interface ShipmentRow {
  id: string;
  user_id: string;
  origin_address: string;
  destination_address: string;
  package_size: 'pequeno' | 'medio' | 'grande';
  recipient_name: string;
  status: ShipmentStatus;
  amount_cents: number;
  created_at: string;
}

export interface DependentShipmentRow {
  id: string;
  user_id: string;
  full_name: string;
  origin_address: string;
  destination_address: string;
  status: ShipmentStatus;
  amount_cents: number;
  created_at: string;
}

export interface ExcursionRequestRow {
  id: string;
  user_id: string;
  destination: string;
  excursion_date: string;
  people_count: number;
  fleet_type: string;
  status: ExcursionStatus;
  total_amount_cents: number | null;
  driver_id: string | null;
  preparer_id: string | null;
  created_at: string;
}

export interface ViagemListItem {
  bookingId: string;
  passageiro: string;
  origem: string;
  destino: string;
  data: string;
  embarque: string;
  chegada: string;
  status: 'concluído' | 'cancelado' | 'agendado' | 'em_andamento';
  tripId: string;
  driverId: string;
}

export interface PassageiroListItem {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  dataCriacao: string;
  cpf: string;
  status: 'Ativo' | 'Inativo';
  avatarUrl: string | null;
}

export interface EncomendaListItem {
  id: string;
  tipo: 'shipment' | 'dependent_shipment';
  destino: string;
  origem: string;
  remetente: string;
  data: string;
  status: 'Cancelado' | 'Concluído' | 'Agendado' | 'Em andamento';
  amountCents: number;
  packageSize?: string;
}

export interface MotoristaListItem {
  id: string;
  nome: string;
  totalViagens: number;
  viagensAtivas: number;
  viagensAgendadas: number;
  avatarUrl: string | null;
  rating: number | null;
}

export interface DestinoListItem {
  origem: string;
  destino: string;
  totalAtividades: number;
  primeiraData: string;
  ativo: boolean;
}

export interface PreparadorListItem {
  id: string;
  nome: string;
  origem: string;
  destino: string;
  dataInicio: string;
  previsao: string;
  avaliacao: number | null;
  status: 'Em andamento' | 'Agendado' | 'Cancelado' | 'Concluído';
}

// ── Promotions ──────────────────────────────────────────────────────
export interface PromotionRow {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  target_audiences: string[];
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  applies_to: string[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromocaoListItem {
  id: string;
  nome: string;
  descricao: string;
  dataInicio: string;
  dataTermino: string;
  tipoPublico: string;
  tipoDesconto: string;
  valorDesconto: number;
  aplicaA: string;
  status: 'Ativo' | 'Inativo';
}

// ── Pagamentos / Payouts ────────────────────────────────────────────
export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

export interface PayoutRow {
  id: string;
  worker_id: string;
  entity_type: 'booking' | 'shipment' | 'dependent_shipment' | 'excursion';
  entity_id: string;
  gross_amount_cents: number;
  worker_amount_cents: number;
  admin_amount_cents: number;
  surcharges_cents: number;
  promotion_discount_cents: number;
  payout_method: 'pix' | 'fixed_monthly' | 'fixed_weekly';
  status: PayoutStatus;
  paid_at: string | null;
  created_at: string;
}

export interface PagamentoListItem {
  id: string;
  workerName: string;
  entityType: string;
  dataFinalizacao: string;
  status: 'Em andamento' | 'Agendado' | 'Cancelado' | 'Concluído';
  grossAmountCents: number;
  workerAmountCents: number;
  adminAmountCents: number;
}

export interface PagamentoCounts {
  pagamentosPrevistos: number;
  pagamentosFeitos: number;
  lucro: number;
}

// ── Pricing Routes ──────────────────────────────────────────────────
export interface PricingRouteRow {
  id: string;
  role_type: 'driver' | 'preparer_excursions' | 'preparer_shipments';
  title: string | null;
  origin_address: string | null;
  destination_address: string;
  pricing_mode: 'daily_rate' | 'per_km' | 'fixed';
  price_cents: number;
  driver_pct: number;
  admin_pct: number;
  accepted_payment_methods: string[];
  is_active: boolean;
  created_at: string;
}

export interface SurchargeCatalogRow {
  id: string;
  name: string;
  description: string | null;
  default_value_cents: number;
  surcharge_mode: 'automatic' | 'manual';
  is_active: boolean;
}

// ── Payment Methods (read-only for admin) ───────────────────────────
export interface PaymentMethodRow {
  id: string;
  user_id: string;
  type: 'credit' | 'debit';
  last_four: string | null;
  brand: string | null;
  holder_name: string | null;
  created_at: string;
}

// ── Admin Users ─────────────────────────────────────────────────────
export interface AdminUserListItem {
  id: string;
  nome: string;
  email: string;
  nivel: string;
  dataCriacao: string;
  status: 'Ativo' | 'Inativo';
  permissions: Record<string, boolean>;
}
