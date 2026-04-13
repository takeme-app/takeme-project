import { supabase } from './supabase';

export interface SupportTicketResult {
  conversationId: string | null;
  assigned: boolean;
}

/**
 * Abre ticket na fila de atendimento do admin (RPC `open_support_ticket`).
 * Retorna o ID da conversa e se foi atribuído a um atendente.
 */
export async function tryOpenSupportTicket(
  category: string,
  context?: Record<string, unknown>,
): Promise<SupportTicketResult> {
  try {
    const { data, error } = await (supabase as any).rpc('open_support_ticket', {
      p_category: category,
      p_context: context ?? {},
    });
    if (error) {
      console.warn('[tryOpenSupportTicket]', error.message);
      return { conversationId: null, assigned: false };
    }
    const convId = typeof data === 'string' ? data : null;
    if (convId) {
      // Verificar se foi atribuído a um atendente
      const { data: conv } = await (supabase as any)
        .from('conversations')
        .select('admin_id')
        .eq('id', convId)
        .maybeSingle();
      return { conversationId: convId, assigned: Boolean(conv?.admin_id) };
    }
    return { conversationId: null, assigned: false };
  } catch (e) {
    console.warn('[tryOpenSupportTicket]', e);
    return { conversationId: null, assigned: false };
  }
}
