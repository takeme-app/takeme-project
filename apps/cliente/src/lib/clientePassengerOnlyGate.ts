import { supabase } from './supabase';

export type ClientePassengerGateResult =
  | { ok: true }
  | { ok: false; message: string };

const BLOCKED_MESSAGE =
  'Esta conta é de motorista ou preparador Take Me. Para trabalhar, use o app Take Me Motorista. Este app é só para passageiros.';

/**
 * O app Cliente é exclusivo de quem usa o serviço como passageiro.
 * Quem tem registro em `worker_profiles` (motorista, preparador, admin, etc.) deve usar o app Motorista.
 */
export async function assertClientePassengerOnlyAccount(userId: string): Promise<ClientePassengerGateResult> {
  // `worker_profiles` não está no tipo Database do app Cliente; a tabela existe no projeto e tem RLS (select próprio).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('worker_profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      message: 'Não foi possível validar seu perfil. Verifique a conexão e tente novamente.',
    };
  }
  if (data?.id) {
    return { ok: false, message: BLOCKED_MESSAGE };
  }
  return { ok: true };
}
