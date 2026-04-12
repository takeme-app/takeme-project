import { supabase } from './supabase';
import { describeInvokeFailure } from '../utils/edgeFunctionResponse';
import { getUserErrorMessage } from '../utils/errorMessage';

/**
 * Renova a sessão e garante `stripe_customer_id` no perfil (mesmo fluxo do checkout de viagem),
 * para depois invocar `charge-booking` / cobrança de envio (`EDGE_CHARGE_SHIPMENT_SLUG`) com `Authorization: Bearer …`.
 */
export async function ensureAccessTokenForStripeFunctions(): Promise<
  { ok: true; accessToken: string } | { ok: false; message: string }
> {
  const {
    data: { session: sessionBefore },
  } = await supabase.auth.getSession();
  if (!sessionBefore?.access_token) {
    return { ok: false, message: 'Faça login novamente para concluir o pagamento.' };
  }
  const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
  const accessToken = refreshData.session?.access_token ?? sessionBefore.access_token;
  if (!accessToken) {
    return {
      ok: false,
      message: getUserErrorMessage(refreshErr, 'Sessão expirada. Faça login novamente.'),
    };
  }
  const { data: ensureData, error: ensureErr } = await supabase.functions.invoke('ensure-stripe-customer', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (ensureErr) {
    const raw = await describeInvokeFailure(ensureData, ensureErr);
    return { ok: false, message: getUserErrorMessage({ message: raw }, raw) };
  }
  return { ok: true, accessToken };
}
