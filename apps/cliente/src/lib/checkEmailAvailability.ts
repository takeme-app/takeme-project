import { supabase } from './supabase';
import { parseInvokeError } from '../utils/edgeFunctionResponse';

export type EmailAvailability = 'available' | 'taken' | 'invalid' | 'error';

export type CheckEmailAvailabilityResult = {
  status: EmailAvailability;
  message?: string;
};

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
