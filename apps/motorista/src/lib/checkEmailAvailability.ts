import { supabase } from './supabase';
import { parseInvokeError } from '../utils/edgeFunctionResponse';

export type EmailAvailability = 'available' | 'taken' | 'invalid' | 'error';

export type CheckEmailAvailabilityResult = {
  status: EmailAvailability;
  /** Mensagem vinda do servidor quando o e-mail já existe ou é inválido — reaproveitada no UI. */
  message?: string;
};

/**
 * Pergunta à edge function `send-email-verification-code` (com `checkEmailOnly: true`) se
 * um e-mail já está cadastrado em `auth.users`. Não dispara e-mail nem gera código.
 *
 * - `available`: e-mail livre para cadastro.
 * - `taken`: já existe conta com esse e-mail (usa a mensagem devolvida pela API).
 * - `invalid`: a API devolveu 400 por outra validação (ex.: propósito inválido).
 * - `error`: falha de rede / não foi possível decidir; UI não deve bloquear o envio apenas por isso.
 *
 * Como a validação final também é executada pela mesma função no momento do `continuar`,
 * um retorno `error` aqui apenas deixa o aviso mais tardio, sem comprometer a segurança.
 */
export async function checkEmailAvailability(email: string): Promise<CheckEmailAvailabilityResult> {
  const normalized = email.trim();
  if (!normalized) return { status: 'invalid', message: 'Preencha o e-mail.' };

  try {
    const { data, error } = await supabase.functions.invoke('send-email-verification-code', {
      body: { email: normalized, purpose: 'signup', checkEmailOnly: true },
    });

    const apiErrorMsg =
      data && typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : null;
    if (apiErrorMsg) return { status: 'taken', message: apiErrorMsg };

    if (error) {
      const bodyError = await parseInvokeError(error);
      if (bodyError) {
        const isTaken = /cadastrad|existe|in use|already/i.test(bodyError);
        return { status: isTaken ? 'taken' : 'invalid', message: bodyError };
      }
      return { status: 'error' };
    }

    return { status: 'available' };
  } catch {
    return { status: 'error' };
  }
}
