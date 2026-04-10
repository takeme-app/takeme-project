import { supabase } from './supabase';

/** Cria ticket de suporte no backoffice (não bloqueia o fluxo em caso de erro). */
export async function tryOpenSupportTicket(
  category: string,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await (supabase as any).rpc('open_support_ticket', {
      p_category: category,
      p_context: context ?? {},
    });
    if (error) console.warn('[tryOpenSupportTicket]', error.message);
  } catch (e) {
    console.warn('[tryOpenSupportTicket]', e);
  }
}
