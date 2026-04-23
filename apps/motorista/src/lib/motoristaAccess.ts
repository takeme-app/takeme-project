import { supabase } from './supabase';

/** Único status que libera o app (definido com o admin). */
export const MOTORISTA_ACTIVE_STATUS = 'approved';

export type StripeConnectState =
  /** Conta ainda não foi criada na Stripe. */
  | 'none'
  /** Conta criada, mas motorista não concluiu o Account Link (details_submitted=false). */
  | 'incomplete'
  /** Dados enviados (details_submitted=true), Stripe ainda não liberou charges_enabled. */
  | 'in_review'
  /**
   * Dados enviados, mas a Stripe pediu informações adicionais
   * (`requirements.currently_due` ou `past_due` não vazios). Motorista precisa
   * reabrir o Stripe via Account Link `account_update`.
   */
  | 'action_required'
  /** Conta totalmente habilitada (charges_enabled=true). */
  | 'active';

export type StripeConnectRow = {
  stripe_connect_account_id: string | null;
  stripe_connect_charges_enabled: boolean | null;
  stripe_connect_details_submitted: boolean | null;
  stripe_connect_requirements_due_count?: number | null;
  /** Campos já enviados, em análise pela Stripe (ex.: PEP do representante). */
  stripe_connect_pending_verification_count?: number | null;
};

/**
 * Deriva o estado do onboarding Stripe Connect a partir das flags espelhadas
 * pelo webhook `account.updated` (ou pela função `stripe-connect-sync`).
 */
export function getStripeConnectState(row: StripeConnectRow | null | undefined): StripeConnectState {
  if (!row?.stripe_connect_account_id) return 'none';
  if (row.stripe_connect_charges_enabled === true) return 'active';
  if (row.stripe_connect_details_submitted === true) {
    if ((row.stripe_connect_requirements_due_count ?? 0) > 0) return 'action_required';
    return 'in_review';
  }
  return 'incomplete';
}

/**
 * O motorista pode usar o app quando terminou de enviar os dados (even if Stripe ainda
 * está analisando). As cobranças feitas nesse intervalo são retidas na plataforma e
 * repassadas depois (charge-booking não aplica transfer_data enquanto charges_enabled
 * é false — ver supabase/functions/charge-booking/index.ts).
 */
export function canUseAppWithStripeState(state: StripeConnectState): boolean {
  return state === 'active' || state === 'in_review' || state === 'action_required';
}

/** @deprecated usar `getStripeConnectState` + `canUseAppWithStripeState`. */
export function isStripeConnectReadyForApp(row: {
  stripe_connect_account_id: string | null;
  stripe_connect_charges_enabled: boolean | null;
}): boolean {
  return Boolean(row.stripe_connect_account_id) && row.stripe_connect_charges_enabled === true;
}

export type MotoristaGateResult =
  | { kind: 'active'; subtype: string; stripeState: StripeConnectState }
  | { kind: 'needs_stripe_connect'; subtype: string; stripeState: StripeConnectState }
  | { kind: 'pending'; status: string }
  | { kind: 'missing_profile' }
  | { kind: 'error'; message: string };

export async function checkMotoristaCanAccessApp(userId: string): Promise<MotoristaGateResult> {
  const { data, error } = await supabase
    .from('worker_profiles')
    .select(
      'status, subtype, stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_details_submitted, stripe_connect_requirements_due_count, stripe_connect_pending_verification_count'
    )
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return {
      kind: 'error',
      message: [error.message, error.hint].filter(Boolean).join(' — ') || 'Erro ao carregar perfil.',
    };
  }
  if (!data?.status) {
    return { kind: 'missing_profile' };
  }
  if (data.status === MOTORISTA_ACTIVE_STATUS) {
    const stripeState = getStripeConnectState(data);
    const subtype = data.subtype ?? 'takeme';
    if (!canUseAppWithStripeState(stripeState)) {
      return { kind: 'needs_stripe_connect', subtype, stripeState };
    }
    return { kind: 'active', subtype, stripeState };
  }
  return { kind: 'pending', status: data.status };
}

export function getMotoristaPendingCopy(status: string): { title: string; message: string } {
  if (status === 'rejected') {
    return {
      title: 'Cadastro não aprovado',
      message:
        'Seu cadastro não foi aprovado. Em caso de dúvida, entre em contato com o suporte Take Me.',
    };
  }
  if (status === 'suspended') {
    return {
      title: 'Conta suspensa',
      message: 'Sua conta está suspensa. Entre em contato com o suporte Take Me para mais informações.',
    };
  }
  return {
    title: 'Cadastro em análise',
    message:
      'Seu cadastro está passando por aprovação da equipe administrativa. Você será notificado quando estiver liberado para usar o app.',
  };
}

/** Mapeia subtype do DB para a rota principal correta. */
export function subtypeToMainRoute(subtype: string): 'Main' | 'MainExcursoes' | 'MainEncomendas' {
  if (subtype === 'excursions') return 'MainExcursoes';
  if (subtype === 'shipments') return 'MainEncomendas';
  return 'Main';
}
