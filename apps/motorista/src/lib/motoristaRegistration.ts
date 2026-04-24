import { supabase } from './supabase';
import { resolveWorkerBaseId } from './resolveWorkerBaseId';
import { ensureWorkerRouteHasCoordinates } from './ensureWorkerRouteCoordinates';
import type { RegistrationType } from '../navigation/types';

/** Mapeia tipo de cadastro para subtype no banco. */
export function mapDriverTypeToSubtypeDb(driverType: RegistrationType): 'takeme' | 'partner' | 'excursions' | 'shipments' {
  if (driverType === 'take_me') return 'takeme';
  if (driverType === 'parceiro') return 'partner';
  if (driverType === 'preparador_excursões') return 'excursions';
  return 'shipments';
}

export type MotoristaRouteInput = {
  origin_address: string;
  destination_address: string;
  price_per_person_cents: number;
  origin_lat?: number | null;
  origin_lng?: number | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
};

export type MotoristaVehicleInput = {
  year: number;
  model: string;
  plate: string;
  passenger_capacity: number;
};

/**
 * Após a refatoração "Onboarding Motorista 3 Etapas" a conta no Auth é criada
 * no momento da verificação do PIN (Etapa 1). Esta função assume o usuário logado
 * e faz UPDATE do `worker_profiles` (linha draft já existente) + INSERT de
 * veículo/rotas. **Não cria mais conta no Auth.**
 *
 * Dados bancários não são mais recebidos aqui — o recebimento é configurado via
 * Stripe Connect na Etapa 3.
 */
export type FinalizeMotoristaProfileInput = {
  userId: string;
  driverType: RegistrationType;
  fullName: string;
  phoneDigits: string | null;
  cpfDigits: string;
  age: number | null;
  city: string | null;
  cityLocality: string | null;
  cityAdminArea: string | null;
  preferenceArea: string | null;
  experienceYears: number | null;
  ownsVehicle: boolean;
  vehicle: MotoristaVehicleInput | null;
  routes: MotoristaRouteInput[];
};

function formatSupabaseErr(e: { message?: string; details?: string; hint?: string } | null): string {
  if (!e) return '';
  return [e.message, e.details, e.hint].filter(Boolean).join(' — ');
}

export async function finalizeMotoristaProfile(input: FinalizeMotoristaProfileInput): Promise<{ userId: string }> {
  const {
    userId,
    driverType,
    fullName,
    cpfDigits,
    age,
    city,
    cityLocality,
    cityAdminArea,
    preferenceArea,
    experienceYears,
    ownsVehicle,
    vehicle,
    routes,
  } = input;

  const subtypeDb = mapDriverTypeToSubtypeDb(driverType);
  const nowIso = new Date().toISOString();

  // 1) profiles: full_name / cpf / city (telefone pessoal, se desejável, fica fora)
  const { data: profRow, error: profSelErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (profSelErr || !profRow) {
    throw new Error(
      'Perfil base (profiles) não encontrado. Verifique o trigger on_auth_user_created em auth.users.'
    );
  }

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      full_name: fullName.trim() || null,
      cpf: cpfDigits,
      city: city?.trim() || null,
      updated_at: nowIso,
    })
    .eq('id', userId);
  if (profileErr) {
    throw new Error(formatSupabaseErr(profileErr) || 'Falha ao atualizar perfil (profiles).');
  }

  // 2) worker_profiles: UPDATE da linha draft (criada junto do Auth na Etapa 1).
  //    Se, por algum motivo, a linha não existir (fluxo legado, falha na Etapa 1),
  //    tenta criar antes de prosseguir.
  const ageForDb =
    age !== null && age !== undefined && Number.isFinite(age) ? Math.round(age) : null;
  const baseId = await resolveWorkerBaseId(cityLocality, cityAdminArea, city?.trim() ?? '');

  const { data: existingWorker } = await supabase
    .from('worker_profiles')
    .select('id, role, subtype, status')
    .eq('id', userId)
    .maybeSingle();

  const roleDb: 'driver' | 'preparer' =
    driverType === 'take_me' || driverType === 'parceiro' ? 'driver' : 'preparer';

  if (!existingWorker) {
    const { error: wpInsErr } = await supabase.from('worker_profiles').insert({
      id: userId,
      role: roleDb,
      subtype: subtypeDb,
      status: 'inactive',
      cpf: cpfDigits,
      age: ageForDb,
      city: city?.trim() || null,
      base_id: baseId,
      experience_years: experienceYears,
      has_own_vehicle: ownsVehicle,
      preference_area: preferenceArea?.trim() || null,
      created_at: nowIso,
      updated_at: nowIso,
    });
    if (wpInsErr) {
      throw new Error(
        formatSupabaseErr(wpInsErr) ||
          'Falha ao criar perfil de motorista. Rode a migration worker_profiles_insert_own.'
      );
    }
  } else {
    const { error: wpUpErr } = await supabase
      .from('worker_profiles')
      .update({
        role: roleDb,
        subtype: subtypeDb,
        cpf: cpfDigits,
        age: ageForDb,
        city: city?.trim() || null,
        base_id: baseId,
        experience_years: experienceYears,
        has_own_vehicle: ownsVehicle,
        preference_area: preferenceArea?.trim() || null,
        updated_at: nowIso,
      })
      .eq('id', userId);
    if (wpUpErr) {
      throw new Error(
        formatSupabaseErr(wpUpErr) ||
          'Falha ao atualizar perfil de motorista (worker_profiles).'
      );
    }
  }

  // 3) vehicles (se aplicável)
  if (ownsVehicle && vehicle) {
    const { error: vehErr } = await supabase.from('vehicles').insert({
      worker_id: userId,
      year: vehicle.year,
      model: vehicle.model.trim(),
      plate: vehicle.plate.trim().toUpperCase().slice(0, 12),
      passenger_capacity: vehicle.passenger_capacity,
      status: 'pending',
      is_active: true,
    });
    if (vehErr) {
      throw new Error(formatSupabaseErr(vehErr) || 'Falha ao salvar veículo.');
    }
  }

  try {
    const { tryOpenSupportTicket } = await import('./supportTickets');
    void tryOpenSupportTicket('cadastro_transporte', { worker_id: userId });
  } catch {
    /* ignore */
  }

  // 4) worker_routes (só para motoristas; preparadores enviam 0 rotas)
  for (const r of routes) {
    const payload: Record<string, unknown> = {
      worker_id: userId,
      origin_address: r.origin_address.trim(),
      destination_address: r.destination_address.trim(),
      price_per_person_cents: Math.round(r.price_per_person_cents),
      is_active: true,
    };
    const ol = r.origin_lat;
    const oln = r.origin_lng;
    const dl = r.destination_lat;
    const dln = r.destination_lng;
    if (ol != null && oln != null && Number.isFinite(ol) && Number.isFinite(oln)) {
      payload.origin_lat = ol;
      payload.origin_lng = oln;
    }
    if (dl != null && dln != null && Number.isFinite(dl) && Number.isFinite(dln)) {
      payload.destination_lat = dl;
      payload.destination_lng = dln;
    }
    const { data: insertedRoute, error: routeErr } = await supabase
      .from('worker_routes')
      .insert(payload as never)
      .select('id')
      .single();
    if (routeErr || !insertedRoute?.id) {
      throw new Error(formatSupabaseErr(routeErr ?? null) || 'Falha ao salvar rotas.');
    }
    const ensured = await ensureWorkerRouteHasCoordinates(supabase, insertedRoute.id as string);
    if (!ensured.ok) {
      console.warn('[finalizeMotoristaProfile] Coordenadas da rota:', ensured.message);
    }
  }

  return { userId };
}
