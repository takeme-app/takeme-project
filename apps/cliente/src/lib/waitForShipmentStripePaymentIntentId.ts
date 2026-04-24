import { supabase } from './supabase';

/**
 * Aguarda o webhook `stripe-webhook` gravar `stripe_payment_intent_id` após Pix (ou outro fluxo assíncrono).
 */
export async function waitForShipmentStripePaymentIntentId(
  table: 'shipments' | 'dependent_shipments' | 'bookings',
  id: string,
  opts?: { timeoutMs?: number; intervalMs?: number },
): Promise<boolean> {
  const timeoutMs = opts?.timeoutMs ?? 10 * 60 * 1000;
  const intervalMs = opts?.intervalMs ?? 2500;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data, error } = await supabase.from(table).select('stripe_payment_intent_id').eq('id', id).maybeSingle();
    if (error) return false;
    const v = data?.stripe_payment_intent_id;
    if (typeof v === 'string' && v.trim().length > 0) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
