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
