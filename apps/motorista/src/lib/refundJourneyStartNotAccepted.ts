import { supabase } from './supabase';

/** Após iniciar a viagem: estorna pedidos cancelados pelo trigger (não bloqueia navegação). */
export async function invokeRefundJourneyStartNotAccepted(tripId: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('refund-journey-start-not-accepted', {
      body: { trip_id: tripId },
    });
    if (error) {
      console.warn('[refund-journey-start-not-accepted]', error.message ?? String(error));
    }
  } catch (e) {
    console.warn('[refund-journey-start-not-accepted]', e);
  }
}
