import { supabase } from './supabase';
import { resolveWorkerBaseId } from './resolveWorkerBaseId';
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

export type RegisterMotoristaWithAuthInput = {
  email: string;
  password: string;
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
  bankCode: string | null;
  agencyNumber: string | null;
  accountNumber: string | null;
  pixKey: string | null;
  ownsVehicle: boolean;
  vehicle: MotoristaVehicleInput | null;
  routes: MotoristaRouteInput[];
};

function formatAuthErr(e: { message?: string } | null): string {
  return (e?.message && String(e.message).trim()) || 'Erro de autenticação.';
}

/**
 * Cria usuário (signUp), perfil e dados de motorista só com cliente Supabase + RLS.
 * worker_profiles.status = inactive até o admin alterar (ex. approved).
 */
export async function registerMotoristaWithAuth(input: RegisterMotoristaWithAuthInput): Promise<{ userId: string }> {
  const {
    email,
    password,
    driverType,
    fullName,
    phoneDigits,
    cpfDigits,
    age,
    city,
    cityLocality,
    cityAdminArea,
    preferenceArea,
    experienceYears,
    bankCode,
    agencyNumber,
    accountNumber,
    pixKey,
    ownsVehicle,
    vehicle,
    routes,
  } = input;

  const emailNorm = email.trim().toLowerCase();
  const subtypeDb = mapDriverTypeToSubtypeDb(driverType);
  const nowIso = new Date().toISOString();

  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email: emailNorm,
    password,
    options: {
      // Não passamos phone aqui para evitar unique_violation no trigger handle_new_user.
      // O telefone é salvo no profiles.update logo abaixo.
      data: {
        full_name: fullName.trim() || undefined,
      },
    },
  });

  if (signUpErr) {
    const m = formatAuthErr(signUpErr).toLowerCase();
    if (m.includes('already') || m.includes('registered') || m.includes('exists')) {
      throw new Error('Este e-mail já está cadastrado. Faça login ou use outro e-mail.');
    }
    throw new Error(formatAuthErr(signUpErr));
  }

  let userId = signUpData.user?.id;
  let session = signUpData.session;

  if (!userId) {
    throw new Error('Cadastro não retornou usuário. Tente novamente.');
  }

  if (!session) {
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: emailNorm,
      password,
    });
    if (signInErr) {
      throw new Error(
        `${formatAuthErr(signInErr)}\n\n` +
          'Se o projeto exige confirmação de e-mail no Auth, desative-a para este fluxo ou confirme o e-mail antes de concluir o cadastro.'
      );
    }
    session = signInData.session;
    userId = signInData.user?.id ?? userId;
  }

  if (!session?.user?.id) {
    throw new Error(
      'Sessão não disponível após criar a conta. Confirme o e-mail ou, em Authentication → Sign in, desative "Confirm email" para cadastro direto.'
    );
  }

  userId = session.user.id;

  const { data: profRow, error: profSelErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (profSelErr || !profRow) {
    throw new Error(
      'Perfil base (profiles) não encontrado após criar a conta. Verifique o trigger on_auth_user_created em auth.users no Supabase.'
    );
  }

  // phoneDigits é o telefone do veículo — não vai para profiles.phone (telefone pessoal).
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
    throw new Error(
      [profileErr.message, profileErr.details, profileErr.hint].filter(Boolean).join(' — ') ||
        'Falha ao atualizar perfil (profiles).'
    );
  }

  const ageForDb =
    age !== null && age !== undefined && Number.isFinite(age) ? Math.round(age) : null;

  const baseId = await resolveWorkerBaseId(cityLocality, cityAdminArea, city?.trim() ?? '');

  const { error: workerErr } = await supabase.from('worker_profiles').insert({
    id: userId,
    role: 'driver',
    subtype: subtypeDb,
    status: 'inactive',
    cpf: cpfDigits,
    age: ageForDb,
    city: city?.trim() || null,
    base_id: baseId,
    experience_years: experienceYears,
    bank_code: bankCode?.trim() || null,
    bank_agency: agencyNumber?.trim() || null,
    bank_account: accountNumber?.trim() || null,
    pix_key: pixKey?.trim() || null,
    has_own_vehicle: ownsVehicle,
    preference_area: preferenceArea?.trim() || null,
    created_at: nowIso,
    updated_at: nowIso,
  });

  if (workerErr) {
    throw new Error(
      [workerErr.message, workerErr.details, workerErr.hint].filter(Boolean).join(' — ') ||
        'Falha ao criar perfil de motorista (worker_profiles). Rode a migration worker_profiles_insert_own.'
    );
  }

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
      throw new Error(
        [vehErr.message, vehErr.details, vehErr.hint].filter(Boolean).join(' — ') || 'Falha ao salvar veículo.'
      );
    }
  }

  try {
    const { tryOpenSupportTicket } = await import('./supportTickets');
    void tryOpenSupportTicket('cadastro_transporte', { worker_id: userId });
  } catch {
    /* ignore */
  }

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
    const { error: routeErr } = await supabase.from('worker_routes').insert(payload as never);
    if (routeErr) {
      throw new Error(
        [routeErr.message, routeErr.details, routeErr.hint].filter(Boolean).join(' — ') || 'Falha ao salvar rotas.'
      );
    }
  }

  return { userId };
}
