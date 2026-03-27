import { supabase } from './supabase';

/** Único status que libera o app (definido com o admin). */
export const MOTORISTA_ACTIVE_STATUS = 'approved';

export type MotoristaGateResult =
  | { kind: 'active'; subtype: string }
  | { kind: 'pending'; status: string }
  | { kind: 'missing_profile' }
  | { kind: 'error'; message: string };

export async function checkMotoristaCanAccessApp(userId: string): Promise<MotoristaGateResult> {
  const { data, error } = await supabase
    .from('worker_profiles')
    .select('status, subtype')
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
    return { kind: 'active', subtype: data.subtype ?? 'takeme' };
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
