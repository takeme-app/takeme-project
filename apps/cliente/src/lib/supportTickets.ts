import { supabase } from './supabase';

/**
 * Abre ticket na fila de atendimento do admin (RPC `open_support_ticket`).
 * Falhas são ignoradas (não bloqueiam o fluxo do app).
 */
export async function tryOpenSupportTicket(
  category: string,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await (supabase as any).rpc('open_support_ticket', {
      p_category: category,
      p_context: context ?? {},
    });
    if (error) {
      console.warn('[tryOpenSupportTicket]', error.message);
    }
  } catch (e) {
    console.warn('[tryOpenSupportTicket]', e);
  }
}
