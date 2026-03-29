import { supabase, isSupabaseConfigured } from '../lib/supabase';
import Constants from 'expo-constants';
import type {
  ViagemListItem,
  PassageiroListItem,
  EncomendaListItem,
  MotoristaListItem,
  DestinoListItem,
  PreparadorListItem,
  PreparadorEditDetail,
  PreparadorCandidate,
  ExcursionStatusHistoryRow,
  PromocaoListItem,
  PagamentoListItem,
  PagamentoCounts,
  PricingRouteRow,
  SurchargeCatalogRow,
  PaymentMethodRow,
  AdminUserListItem,
} from './types';

// ── Edge Function Helper ─────────────────────────────────────────────────

const extra = Constants.expoConfig?.extra as { supabaseUrl?: string; supabaseAnonKey?: string } | undefined;
const supabaseUrl = extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = extra?.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function invokeEdgeFunction<T = any>(
  name: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  params?: Record<string, string>,
  body?: any,
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { data: null, error: 'Não autenticado' };

    const url = new URL(`${supabaseUrl}/functions/v1/${name}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      method,
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || `HTTP ${res.status}` };
    return { data: json as T, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Erro desconhecido' };
  }
}

// ── CRUD: Promotions ────────────────────────────────────────────────────

export async function createPromotion(body: {
  title: string;
  description?: string;
  start_at: string;
  end_at: string;
  target_audiences: string[];
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  applies_to: string[];
  is_active?: boolean;
}) {
  return invokeEdgeFunction('manage-promotions', 'POST', undefined, body);
}

export async function updatePromotion(id: string, updates: Record<string, any>) {
  return invokeEdgeFunction('manage-promotions', 'PUT', { id }, updates);
}

export async function deletePromotion(id: string) {
  return invokeEdgeFunction('manage-promotions', 'DELETE', { id });
}

// ── CRUD: Pricing Routes ────────────────────────────────────────────────

export async function createPricingRoute(body: {
  role_type: string;
  title?: string;
  origin_address?: string;
  destination_address: string;
  pricing_mode: string;
  price_cents: number;
  driver_pct?: number;
  admin_pct?: number;
  accepted_payment_methods?: string[];
  surcharges?: Array<{ surcharge_id: string; value_cents?: number }>;
}) {
  return invokeEdgeFunction('manage-pricing-routes', 'POST', undefined, body);
}

export async function updatePricingRoute(id: string, updates: Record<string, any>) {
  return invokeEdgeFunction('manage-pricing-routes', 'PUT', { id }, updates);
}

export async function deletePricingRoute(id: string) {
  return invokeEdgeFunction('manage-pricing-routes', 'DELETE', { id });
}

// ── CRUD: Excursion Budget ──────────────────────────────────────────────

export async function submitExcursionBudget(excursionId: string, budgetLines: any, finalize = false) {
  return invokeEdgeFunction('manage-excursion-budget', 'POST', undefined, {
    excursion_id: excursionId,
    budget_lines: budgetLines,
    finalize,
  });
}

// ── CRUD: Admin Users (via edge function) ───────────────────────────────

export async function createAdminUser(body: {
  email: string;
  password?: string;
  full_name: string;
  permissions?: Record<string, boolean>;
}) {
  return invokeEdgeFunction('manage-admin-users', 'POST', undefined, body);
}

export async function updateAdminUser(id: string, updates: { permissions?: Record<string, boolean>; status?: string }) {
  return invokeEdgeFunction('manage-admin-users', 'PUT', { id }, updates);
}

export async function deleteAdminUser(id: string) {
  return invokeEdgeFunction('manage-admin-users', 'DELETE', { id });
}

// ── Helpers ─────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function shortAddr(addr: string): string {
  const parts = addr.split(',').map((s) => s.trim());
  if (parts.length >= 2) return `${parts[0]} - ${parts[parts.length - 1]}`;
  return addr;
}

type BookingDbStatus = 'pending' | 'confirmed' | 'paid' | 'cancelled';
type TripDbStatus = 'active' | 'cancelled' | 'completed';

function mapViagemStatus(
  bookingStatus: BookingDbStatus,
  tripStatus: TripDbStatus,
): ViagemListItem['status'] {
  if (bookingStatus === 'cancelled' || tripStatus === 'cancelled') return 'cancelado';
  if (tripStatus === 'completed' || bookingStatus === 'paid') return 'concluído';
  if (tripStatus === 'active' && (bookingStatus === 'confirmed' || bookingStatus === 'pending')) return 'em_andamento';
  return 'agendado';
}

type ShipmentDbStatus = 'pending_review' | 'confirmed' | 'in_progress' | 'delivered' | 'cancelled';

function mapEncomendaStatus(s: ShipmentDbStatus): EncomendaListItem['status'] {
  if (s === 'cancelled') return 'Cancelado';
  if (s === 'delivered') return 'Concluído';
  if (s === 'in_progress') return 'Em andamento';
  return 'Agendado';
}

type ExcursionDbStatus = 'pending' | 'contacted' | 'quoted' | 'cancelled' | 'in_analysis' | 'approved' | 'scheduled' | 'in_progress' | 'completed';

function mapPreparadorStatus(s: ExcursionDbStatus): PreparadorListItem['status'] {
  if (s === 'cancelled') return 'Cancelado';
  if (s === 'completed') return 'Concluído';
  if (s === 'in_progress') return 'Em andamento';
  return 'Agendado';
}

// ── Viagens ─────────────────────────────────────────────────────────────

export async function fetchViagens(): Promise<ViagemListItem[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, user_id, origin_address, destination_address, status, created_at,
      scheduled_trip_id,
      scheduled_trips!inner ( id, departure_at, arrival_at, driver_id, status ),
      profiles!bookings_user_id_fkey ( full_name )
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data) return [];

  return data.map((b: any) => {
    const trip = b.scheduled_trips;
    const profile = b.profiles;
    return {
      bookingId: b.id,
      passageiro: profile?.full_name ?? 'Sem nome',
      origem: shortAddr(b.origin_address),
      destino: shortAddr(b.destination_address),
      data: fmtDate(trip?.departure_at ?? b.created_at),
      embarque: fmtTime(trip?.departure_at ?? b.created_at),
      chegada: fmtTime(trip?.arrival_at ?? b.created_at),
      status: mapViagemStatus(b.status, trip?.status ?? 'active'),
      tripId: trip?.id ?? b.scheduled_trip_id,
      driverId: trip?.driver_id ?? '',
    };
  });
}

export interface ViagemCounts {
  total: number;
  concluidas: number;
  agendadas: number;
  emAndamento: number;
  canceladas: number;
}

export async function fetchViagemCounts(): Promise<ViagemCounts> {
  const items = await fetchViagens();
  return {
    total: items.length,
    concluidas: items.filter((i) => i.status === 'concluído').length,
    agendadas: items.filter((i) => i.status === 'agendado').length,
    emAndamento: items.filter((i) => i.status === 'em_andamento').length,
    canceladas: items.filter((i) => i.status === 'cancelado').length,
  };
}

// ── Passageiros ─────────────────────────────────────────────────────────

export async function fetchPassageiros(): Promise<PassageiroListItem[]> {
  // Exclude workers (drivers, preparers, admins) — only show client app users
  const { data: workerIds } = await supabase
    .from('worker_profiles')
    .select('id');
  const excludeSet = new Set((workerIds ?? []).map((w: any) => w.id));

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, avatar_url, cpf, city, state, verified, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error || !data) return [];

  return data
    .filter((p: any) => !excludeSet.has(p.id))
    .map((p: any) => ({
      id: p.id,
      nome: p.full_name ?? 'Sem nome',
      cidade: p.city ?? '—',
      estado: p.state ?? '—',
      dataCriacao: fmtDate(p.created_at),
      cpf: p.cpf ?? '—',
      status: p.verified ? 'Ativo' as const : 'Inativo' as const,
      avatarUrl: p.avatar_url,
    }));
}

export interface PassageiroCounts {
  total: number;
  ativos: number;
  inativos: number;
}

export async function fetchPassageiroCounts(): Promise<PassageiroCounts> {
  const items = await fetchPassageiros();
  return {
    total: items.length,
    ativos: items.filter((i) => i.status === 'Ativo').length,
    inativos: items.filter((i) => i.status === 'Inativo').length,
  };
}

// ── Encomendas ──────────────────────────────────────────────────────────

export async function fetchEncomendas(): Promise<EncomendaListItem[]> {
  const [shipRes, depRes] = await Promise.all([
    supabase
      .from('shipments')
      .select('id, origin_address, destination_address, recipient_name, status, amount_cents, package_size, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('dependent_shipments')
      .select('id, origin_address, destination_address, full_name, status, amount_cents, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const shipments: EncomendaListItem[] = (shipRes.data ?? []).map((s: any) => ({
    id: s.id,
    tipo: 'shipment' as const,
    destino: shortAddr(s.destination_address),
    origem: shortAddr(s.origin_address),
    remetente: s.recipient_name,
    data: fmtDate(s.created_at),
    status: mapEncomendaStatus(s.status),
    amountCents: s.amount_cents,
    packageSize: s.package_size,
  }));

  const depShipments: EncomendaListItem[] = (depRes.data ?? []).map((d: any) => ({
    id: d.id,
    tipo: 'dependent_shipment' as const,
    destino: shortAddr(d.destination_address),
    origem: shortAddr(d.origin_address),
    remetente: d.full_name,
    data: fmtDate(d.created_at),
    status: mapEncomendaStatus(d.status),
    amountCents: d.amount_cents,
  }));

  return [...shipments, ...depShipments].sort(
    (a, b) => b.data.localeCompare(a.data),
  );
}

export interface EncomendaCounts {
  total: number;
  concluidas: number;
  emAndamento: number;
  agendadas: number;
  canceladas: number;
}

export async function fetchEncomendaCounts(): Promise<EncomendaCounts> {
  const items = await fetchEncomendas();
  return {
    total: items.length,
    concluidas: items.filter((i) => i.status === 'Concluído').length,
    emAndamento: items.filter((i) => i.status === 'Em andamento').length,
    agendadas: items.filter((i) => i.status === 'Agendado').length,
    canceladas: items.filter((i) => i.status === 'Cancelado').length,
  };
}

// ── Motoristas ──────────────────────────────────────────────────────────

export async function fetchMotoristas(): Promise<MotoristaListItem[]> {
  const { data: trips, error } = await supabase
    .from('scheduled_trips')
    .select('driver_id, status')
    .limit(5000);

  if (error || !trips) return [];

  const driverMap = new Map<string, { total: number; active: number; scheduled: number }>();
  for (const t of trips as any[]) {
    const did = t.driver_id as string;
    const entry = driverMap.get(did) ?? { total: 0, active: 0, scheduled: 0 };
    entry.total++;
    if (t.status === 'active') entry.active++;
    if (t.status === 'active') entry.scheduled++;
    driverMap.set(did, entry);
  }

  const driverIds = Array.from(driverMap.keys());
  if (driverIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, rating')
    .in('id', driverIds);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  return driverIds.map((did) => {
    const stats = driverMap.get(did)!;
    const p = profileMap.get(did) as any;
    return {
      id: did,
      nome: p?.full_name ?? 'Sem nome',
      totalViagens: stats.total,
      viagensAtivas: stats.active,
      viagensAgendadas: stats.scheduled,
      avatarUrl: p?.avatar_url ?? null,
      rating: p?.rating ?? null,
    };
  }).sort((a, b) => b.totalViagens - a.totalViagens);
}

// ── Motorista Table Rows (with trip details) ────────────────────────────

export interface MotoristaTableRow {
  nome: string;
  origem: string;
  destino: string;
  data: string;
  embarque: string;
  chegada: string;
  status: 'Concluído' | 'Cancelado' | 'Agendado' | 'Em andamento';
  driverId: string;
  avatarUrl: string | null;
}

export async function fetchMotoristaTableRows(): Promise<MotoristaTableRow[]> {
  // Get trips with driver profiles
  const { data: trips, error } = await supabase
    .from('scheduled_trips')
    .select('id, driver_id, origin_address, destination_address, departure_at, arrival_at, status')
    .order('departure_at', { ascending: false })
    .limit(100);

  if (error || !trips || trips.length === 0) return [];

  const driverIds = [...new Set((trips as any[]).map((t) => t.driver_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', driverIds);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  return (trips as any[]).map((t) => {
    const p = profileMap.get(t.driver_id) as any;
    const tripStatus = t.status as string;
    let uiStatus: MotoristaTableRow['status'] = 'Em andamento';
    if (tripStatus === 'completed') uiStatus = 'Concluído';
    else if (tripStatus === 'cancelled') uiStatus = 'Cancelado';
    else if (tripStatus === 'scheduled') uiStatus = 'Agendado';

    return {
      nome: p?.full_name ?? 'Sem nome',
      origem: shortAddr(t.origin_address || ''),
      destino: shortAddr(t.destination_address || ''),
      data: t.departure_at ? fmtDate(t.departure_at) : '—',
      embarque: t.departure_at ? fmtTime(t.departure_at) : '—',
      chegada: t.arrival_at ? fmtTime(t.arrival_at) : '—',
      status: uiStatus,
      driverId: t.driver_id,
      avatarUrl: p?.avatar_url ?? null,
    };
  });
}

// ── Destinos ────────────────────────────────────────────────────────────

export async function fetchDestinos(): Promise<DestinoListItem[]> {
  const { data, error } = await supabase
    .from('scheduled_trips')
    .select('origin_address, destination_address, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error || !data) return [];

  const routeMap = new Map<string, { count: number; firstDate: string; hasActive: boolean }>();
  for (const t of data as any[]) {
    const key = `${shortAddr(t.origin_address)}|||${shortAddr(t.destination_address)}`;
    const entry = routeMap.get(key) ?? { count: 0, firstDate: t.created_at, hasActive: false };
    entry.count++;
    if (t.status === 'active') entry.hasActive = true;
    if (t.created_at < entry.firstDate) entry.firstDate = t.created_at;
    routeMap.set(key, entry);
  }

  return Array.from(routeMap.entries()).map(([key, val]) => {
    const [origem, destino] = key.split('|||');
    return {
      origem,
      destino,
      totalAtividades: val.count,
      primeiraData: fmtDate(val.firstDate),
      ativo: val.hasActive,
    };
  }).sort((a, b) => b.totalAtividades - a.totalAtividades);
}

// ── Preparadores ────────────────────────────────────────────────────────

function fmtBRLFromCents(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(Number(cents))) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents) / 100);
}

/** Exibe centavos em BRL (ex.: painel preparador). */
export function formatCurrencyBRL(cents: number | null | undefined): string {
  return fmtBRLFromCents(cents);
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
}

export async function fetchPreparadores(): Promise<PreparadorListItem[]> {
  const { data, error } = await supabase
    .from('excursion_requests')
    .select(`
      id, destination, excursion_date, status, preparer_id, scheduled_departure_at, created_at,
      profiles!excursion_requests_preparer_id_fkey ( full_name )
    `)
    .not('preparer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data) return [];

  return data.map((e: any) => {
    const profile = e.profiles;
    return {
      id: e.id,
      nome: profile?.full_name ?? 'Preparador',
      origem: '—',
      destino: e.destination,
      dataInicio: e.scheduled_departure_at ? `${fmtDate(e.scheduled_departure_at)}\n${fmtTime(e.scheduled_departure_at)}` : fmtDate(e.excursion_date),
      previsao: '—',
      avaliacao: null,
      status: mapPreparadorStatus(e.status),
    };
  });
}

export async function fetchPreparadorById(id: string): Promise<PreparadorListItem | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('excursion_requests')
    .select(`
      id, destination, excursion_date, status, preparer_id, scheduled_departure_at, created_at,
      profiles!excursion_requests_preparer_id_fkey ( full_name )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  const e = data as any;
  const profile = e.profiles;
  return {
    id: e.id,
    nome: profile?.full_name ?? 'Preparador',
    origem: '—',
    destino: e.destination,
    dataInicio: e.scheduled_departure_at ? `${fmtDate(e.scheduled_departure_at)}\n${fmtTime(e.scheduled_departure_at)}` : fmtDate(e.excursion_date),
    previsao: '—',
    avaliacao: null,
    status: mapPreparadorStatus(e.status),
  };
}

export async function fetchPreparadorEditDetail(id: string): Promise<PreparadorEditDetail | null> {
  if (!isSupabaseConfigured) return null;

  const { data: er, error } = await supabase
    .from('excursion_requests')
    .select(`
      id, user_id, destination, excursion_date, people_count, fleet_type, observations, status,
      total_amount_cents, scheduled_departure_at, preparer_id, vehicle_details, budget_lines, assignment_notes,
      excursion_passengers ( id, full_name, cpf, phone, observations )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error || !er) return null;

  const row = er as any;
  const passengersRaw = row.excursion_passengers as any[] | null;
  const passengers: PreparadorEditPassenger[] = (passengersRaw ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name ?? '',
    cpf: p.cpf ?? null,
    phone: p.phone ?? null,
    observations: p.observations ?? null,
  }));

  const [{ data: clientProf }, { data: prepProf }, { data: worker }, { data: vehs }] = await Promise.all([
    supabase.from('profiles').select('full_name, phone, cpf, city, state').eq('id', row.user_id).maybeSingle(),
    row.preparer_id
      ? supabase.from('profiles').select('full_name, phone, cpf, city, state, avatar_url, rating').eq('id', row.preparer_id).maybeSingle()
      : Promise.resolve({ data: null } as const),
    row.preparer_id
      ? supabase.from('worker_profiles').select('cpf, age, experience_years, bank_code, bank_agency, bank_account, pix_key, subtype').eq('id', row.preparer_id).maybeSingle()
      : Promise.resolve({ data: null } as const),
    row.preparer_id
      ? supabase.from('vehicles').select('id, year, model, plate, passenger_capacity').eq('worker_id', row.preparer_id).eq('is_active', true).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] } as const),
  ]);

  const cp = clientProf as any;
  const pp = prepProf as any;
  const wk = worker as any;
  const vehiclesList = (vehs as any[]) ?? [];

  return {
    id: row.id,
    userId: row.user_id,
    destination: row.destination ?? '',
    excursionDate: row.excursion_date ?? '',
    scheduledDepartureAt: row.scheduled_departure_at ?? null,
    peopleCount: row.people_count ?? 1,
    fleetType: row.fleet_type ?? 'carro',
    observations: row.observations ?? null,
    statusRaw: row.status ?? 'pending',
    statusLabel: mapPreparadorStatus(row.status as ExcursionDbStatus),
    totalAmountCents: row.total_amount_cents ?? null,
    preparerId: row.preparer_id ?? null,
    vehicleDetails: asRecord(row.vehicle_details),
    budgetLines: Array.isArray(row.budget_lines) ? row.budget_lines : [],
    assignmentNotes: asRecord(row.assignment_notes),
    clientNome: cp?.full_name ?? null,
    clientCity: cp?.city ?? null,
    clientState: cp?.state ?? null,
    clientCpf: cp?.cpf ?? null,
    clientPhone: cp?.phone ?? null,
    passengers,
    preparerProfile: row.preparer_id
      ? {
          fullName: pp?.full_name ?? null,
          phone: pp?.phone ?? null,
          cpf: pp?.cpf ?? null,
          city: pp?.city ?? null,
          state: pp?.state ?? null,
          avatarUrl: pp?.avatar_url ?? null,
          rating: pp?.rating != null ? Number(pp.rating) : null,
        }
      : null,
    preparerWorker: row.preparer_id && wk
      ? {
          cpf: wk.cpf ?? null,
          age: wk.age ?? null,
          experienceYears: wk.experience_years ?? null,
          bankCode: wk.bank_code ?? null,
          bankAgency: wk.bank_agency ?? null,
          bankAccount: wk.bank_account ?? null,
          pixKey: wk.pix_key ?? null,
          subtype: wk.subtype ?? null,
        }
      : null,
    vehicles: vehiclesList.map((v) => ({
      id: v.id,
      year: v.year ?? null,
      model: v.model ?? null,
      plate: v.plate ?? null,
      passengerCapacity: v.passenger_capacity ?? null,
    })),
  };
}

export async function fetchPreparadorCandidates(): Promise<PreparadorCandidate[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('worker_profiles')
    .select('id, subtype, profiles ( full_name, avatar_url, rating )')
    .in('subtype', ['excursions', 'shipments'])
    .neq('status', 'inactive')
    .order('created_at', { ascending: false })
    .limit(40);

  if (error || !data) return [];

  return (data as any[]).map((w) => {
    const p = w.profiles;
    const badge: 'takeme' | 'parceiro' = w.subtype === 'partner' ? 'parceiro' : 'takeme';
    return {
      id: w.id,
      nome: p?.full_name ?? 'Preparador',
      rating: p?.rating != null ? Number(p.rating) : null,
      avatarUrl: p?.avatar_url ?? null,
      subtype: w.subtype ?? '',
      badge,
      valorKm: '—',
      valorFixo: '—',
    };
  });
}

export async function fetchExcursionStatusHistory(excursionId: string): Promise<ExcursionStatusHistoryRow[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('status_history')
    .select('status, changed_at')
    .eq('entity_type', 'excursion')
    .eq('entity_id', excursionId)
    .order('changed_at', { ascending: false })
    .limit(40);

  if (error || !data) return [];
  return (data as any[]).map((r) => ({ status: r.status, changedAt: r.changed_at }));
}

export async function savePreparadorExcursionFields(
  excursionId: string,
  fields: {
    destination?: string;
    scheduled_departure_at?: string | null;
    observations?: string | null;
    fleet_type?: string;
    preparer_id?: string | null;
    vehicle_details?: Record<string, unknown> | null;
    assignment_notes?: Record<string, unknown> | null;
  },
): Promise<{ error: string | null }> {
  const { error } = await (supabase.from('excursion_requests') as any).update(fields).eq('id', excursionId);
  return { error: error ? (error as Error).message : null };
}

export async function saveProfileFields(
  profileId: string,
  fields: { full_name?: string; cpf?: string | null },
): Promise<{ error: string | null }> {
  const { error } = await (supabase.from('profiles') as any).update(fields).eq('id', profileId);
  return { error: error ? (error as Error).message : null };
}

export async function saveWorkerProfileFields(
  workerId: string,
  fields: {
    cpf?: string | null;
    age?: number | null;
    experience_years?: number | null;
    bank_code?: string | null;
    bank_agency?: string | null;
    bank_account?: string | null;
    pix_key?: string | null;
  },
): Promise<{ error: string | null }> {
  const { error } = await (supabase.from('worker_profiles') as any)
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', workerId);
  return { error: error ? (error as Error).message : null };
}

export async function saveVehicleFields(
  vehicleId: string,
  fields: { year?: number | null; model?: string | null; plate?: string | null },
): Promise<{ error: string | null }> {
  const { error } = await (supabase.from('vehicles') as any).update(fields).eq('id', vehicleId);
  return { error: error ? (error as Error).message : null };
}

// ── Home dashboard counts ───────────────────────────────────────────────

export interface HomeCounts {
  viagens: ViagemCounts;
  encomendas: EncomendaCounts;
}

export async function fetchHomeCounts(): Promise<HomeCounts> {
  const [viagens, encomendas] = await Promise.all([
    fetchViagemCounts(),
    fetchEncomendaCounts(),
  ]);
  return { viagens, encomendas };
}

// ── Promotions ──────────────────────────────────────────────────────

function mapTargetAudience(audiences: string[]): string {
  const map: Record<string, string> = {
    drivers: 'Motorista', passengers: 'Passageiro',
    preparers_shipments: 'Prep. Encomendas', preparers_excursions: 'Prep. Excursões',
  };
  return audiences.map((a) => map[a] || a).join(', ');
}

function mapAppliesTo(applies: string[]): string {
  const map: Record<string, string> = {
    bookings: 'Viagens', shipments: 'Encomendas',
    dependent_shipments: 'Dependentes', excursions: 'Excursões',
  };
  return applies.map((a) => map[a] || a).join(', ');
}

export async function fetchPromocoes(): Promise<PromocaoListItem[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((p: any) => ({
    id: p.id,
    nome: p.title,
    descricao: p.description || '',
    dataInicio: fmtDate(p.start_at),
    dataTermino: fmtDate(p.end_at),
    startAtIso: p.start_at ?? '',
    endAtIso: p.end_at ?? '',
    tipoPublico: mapTargetAudience(p.target_audiences || []),
    tipoDesconto: p.discount_type === 'percentage' ? 'Percentual' : 'Fixo',
    valorDesconto: p.discount_value,
    aplicaA: mapAppliesTo(p.applies_to || []),
    status: p.is_active ? 'Ativo' as const : 'Inativo' as const,
  }));
}

export interface PromocaoCounts { total: number; ativas: number; inativas: number; }
export async function fetchPromocaoCounts(): Promise<PromocaoCounts> {
  const items = await fetchPromocoes();
  return {
    total: items.length,
    ativas: items.filter((i) => i.status === 'Ativo').length,
    inativas: items.filter((i) => i.status === 'Inativo').length,
  };
}

// ── Pagamentos / Payouts ────────────────────────────────────────────

function mapPayoutStatus(s: string): PagamentoListItem['status'] {
  if (s === 'paid') return 'Concluído';
  if (s === 'processing') return 'Em andamento';
  if (s === 'failed') return 'Cancelado';
  return 'Agendado';
}

function mapEntityType(t: string): string {
  const map: Record<string, string> = {
    booking: 'Viagem', shipment: 'Encomenda',
    dependent_shipment: 'Dependente', excursion: 'Excursão',
  };
  return map[t] || t;
}

export async function fetchPagamentos(): Promise<PagamentoListItem[]> {
  const { data, error } = await supabase
    .from('payouts')
    .select('id, worker_id, entity_type, entity_id, gross_amount_cents, worker_amount_cents, admin_amount_cents, status, paid_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data) return [];

  // Fetch worker names in bulk
  const workerIds = [...new Set(data.map((p: any) => p.worker_id))];
  const { data: workers } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', workerIds);

  const nameMap: Record<string, string> = {};
  (workers || []).forEach((w: any) => { nameMap[w.id] = w.full_name || 'Sem nome'; });

  return data.map((p: any) => ({
    id: p.id,
    workerName: nameMap[p.worker_id] || 'Sem nome',
    entityType: mapEntityType(p.entity_type),
    dataFinalizacao: p.paid_at ? fmtDate(p.paid_at) : fmtDate(p.created_at),
    dateAtIso: p.paid_at || p.created_at || '',
    status: mapPayoutStatus(p.status),
    grossAmountCents: p.gross_amount_cents,
    workerAmountCents: p.worker_amount_cents,
    adminAmountCents: p.admin_amount_cents,
  }));
}

export async function fetchPagamentoCounts(): Promise<PagamentoCounts> {
  const { data, error } = await supabase
    .from('payouts')
    .select('status, gross_amount_cents, admin_amount_cents');

  if (error || !data) return { pagamentosPrevistos: 0, pagamentosFeitos: 0, lucro: 0 };

  const pending = data.filter((p: any) => p.status === 'pending' || p.status === 'processing');
  const paid = data.filter((p: any) => p.status === 'paid');

  return {
    pagamentosPrevistos: pending.reduce((s: number, p: any) => s + (p.gross_amount_cents || 0), 0),
    pagamentosFeitos: paid.reduce((s: number, p: any) => s + (p.gross_amount_cents || 0), 0),
    lucro: paid.reduce((s: number, p: any) => s + (p.admin_amount_cents || 0), 0),
  };
}

// ── Pricing Routes ──────────────────────────────────────────────────

export async function fetchPricingRoutes(roleType?: string): Promise<PricingRouteRow[]> {
  let query = supabase
    .from('pricing_routes')
    .select('*')
    .order('created_at', { ascending: false });

  if (roleType) query = query.eq('role_type', roleType);

  const { data, error } = await query;
  if (error || !data) return [];
  return data as PricingRouteRow[];
}

export async function fetchSurchargeCatalog(): Promise<SurchargeCatalogRow[]> {
  const { data, error } = await supabase
    .from('surcharge_catalog')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error || !data) return [];
  return data as SurchargeCatalogRow[];
}

// ── Payment Methods (read-only) ─────────────────────────────────────

export async function fetchPassageiroPaymentMethods(userId: string): Promise<PaymentMethodRow[]> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, user_id, type, last_four, brand, holder_name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as PaymentMethodRow[];
}

// ── Passageiro Bookings (for detail screen) ─────────────────────────

export async function fetchPassageiroBookings(userId: string): Promise<ViagemListItem[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, user_id, origin_address, destination_address, status, created_at, scheduled_trip_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((b: any) => ({
    bookingId: b.id,
    passageiro: '',
    origem: shortAddr(b.origin_address),
    destino: shortAddr(b.destination_address),
    data: fmtDate(b.created_at),
    embarque: '—',
    chegada: '—',
    status: mapViagemStatus(b.status as BookingDbStatus, 'active' as TripDbStatus),
    tripId: b.scheduled_trip_id || '',
    driverId: '',
  }));
}

// ── Admin Users ─────────────────────────────────────────────────────

export async function fetchAdminUsers(): Promise<AdminUserListItem[]> {
  const { data, error } = await supabase
    .from('worker_profiles')
    .select('id, role, subtype, status, created_at')
    .eq('role', 'admin');

  if (error || !data) return [];

  const adminIds = data.map((a: any) => a.id);
  if (adminIds.length === 0) return [];

  // Fetch profiles for names
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', adminIds);

  const nameMap: Record<string, string> = {};
  (profiles || []).forEach((p: any) => { nameMap[p.id] = p.full_name || 'Sem nome'; });

  // Fetch permissions from user_preferences
  const { data: prefs } = await supabase
    .from('user_preferences')
    .select('user_id, value')
    .in('user_id', adminIds)
    .eq('key', 'admin_permissions');

  const permMap: Record<string, Record<string, boolean>> = {};
  (prefs || []).forEach((p: any) => { permMap[p.user_id] = p.value || {}; });

  return data.map((a: any) => ({
    id: a.id,
    nome: nameMap[a.id] || 'Sem nome',
    email: '', // email is in auth.users, not accessible via client
    nivel: a.subtype === 'admin' ? 'Administrador' : a.subtype,
    dataCriacao: fmtDate(a.created_at),
    status: a.status === 'approved' ? 'Ativo' as const : 'Inativo' as const,
    permissions: permMap[a.id] || {},
  }));
}

// ── Worker Ratings (for PagamentosGestao Avaliações tab) ────────────

export interface RatingListItem {
  id: string;
  workerName: string;
  ratedByName: string;
  entityType: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export async function fetchWorkerRatings(): Promise<RatingListItem[]> {
  const { data: bookingRatings } = await supabase
    .from('booking_ratings')
    .select('id, booking_id, rating, comment, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: shipmentRatings } = await supabase
    .from('shipment_ratings')
    .select('id, shipment_id, rating, comment, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(50);

  const all = [
    ...(bookingRatings || []).map((r: any) => ({ ...r, entityType: 'Viagem' })),
    ...(shipmentRatings || []).map((r: any) => ({ ...r, entityType: 'Encomenda' })),
  ];

  // Get user names
  const userIds = [...new Set(all.map((r) => r.user_id))];
  const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
  const nameMap: Record<string, string> = {};
  (profiles || []).forEach((p: any) => { nameMap[p.id] = p.full_name || 'Anônimo'; });

  return all.map((r) => ({
    id: r.id,
    workerName: '—',
    ratedByName: nameMap[r.user_id] || 'Anônimo',
    entityType: r.entityType,
    rating: r.rating,
    comment: r.comment || '',
    createdAt: fmtDate(r.created_at),
  }));
}

// ── Bases (centros de recebimento de encomendas) ──────────────────────

export type BaseListItem = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
  createdAt: string;
};

export async function fetchBases(): Promise<BaseListItem[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('bases')
    .select('id, name, address, city, state, lat, lng, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((b: any) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    city: b.city,
    state: b.state ?? '',
    lat: b.lat,
    lng: b.lng,
    isActive: b.is_active,
    createdAt: fmtDate(b.created_at),
  }));
}

export type CreateBaseInput = {
  name: string;
  address: string;
  city: string;
  state: string;
  lat?: number;
  lng?: number;
};

export async function createBase(input: CreateBaseInput): Promise<BaseListItem | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('bases')
    .insert({
      name: input.name,
      address: input.address,
      city: input.city,
      state: input.state,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
    })
    .select()
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    address: data.address,
    city: data.city,
    state: data.state ?? '',
    lat: data.lat,
    lng: data.lng,
    isActive: data.is_active,
    createdAt: fmtDate(data.created_at),
  };
}
