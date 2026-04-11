import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Reutiliza o ticket de suporte ativo mais recente ou cria um novo via RPC `open_support_ticket`.
 * Filtra por `conversation_kind = support_backoffice` e participação do utilizador autenticado.
 */
export async function getOrCreateActiveSupportConversationId(
  supabase: SupabaseClient,
  options?: {
    newTicketCategory?: string;
    newTicketContext?: Record<string, unknown>;
  },
): Promise<{ conversationId: string | null; error: string | null }> {
  const category = options?.newTicketCategory ?? 'outros';
  const context = options?.newTicketContext ?? {};

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user?.id) {
    return { conversationId: null, error: userErr?.message ?? 'Sessão inválida.' };
  }

  const uid = user.id;

  const { data: existing, error: selErr } = await supabase
    .from('conversations')
    .select('id')
    .eq('conversation_kind', 'support_backoffice')
    .eq('status', 'active')
    .or(`driver_id.eq.${uid},client_id.eq.${uid},support_requester_id.eq.${uid}`)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (selErr) {
    return { conversationId: null, error: selErr.message };
  }

  const existingId = (existing as { id?: string } | null)?.id;
  if (existingId) {
    return { conversationId: existingId, error: null };
  }

  const { data: newId, error: rpcErr } = await supabase.rpc('open_support_ticket', {
    p_category: category,
    p_context: context,
  });

  if (rpcErr) {
    return { conversationId: null, error: rpcErr.message };
  }

  const id = typeof newId === 'string' ? newId : null;
  return { conversationId: id, error: id ? null : 'Resposta inesperada do servidor.' };
}
