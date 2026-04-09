/**
 * Compatível com DB antes/depois da migration de anexos (message_kind, attachment_path).
 */

export type ChatMessageRow = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  message_kind?: string;
  attachment_path?: string | null;
};

const SEL_FULL =
  'id, sender_id, content, created_at, read_at, message_kind, attachment_path';
const SEL_BASE = 'id, sender_id, content, created_at, read_at';

type Sb = { from: (t: string) => any };

function isMissingChatColumnsError(err: { message?: string; details?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = `${err.message ?? ''} ${err.details ?? ''}`.toLowerCase();
  if (err.code === 'PGRST204') return true;
  return (
    m.includes('message_kind') ||
    m.includes('attachment_path') ||
    (m.includes('column') && (m.includes('does not exist') || m.includes('schema cache')))
  );
}

export async function fetchChatMessages(
  sb: Sb,
  conversationId: string,
): Promise<{ data: ChatMessageRow[]; error: string | null }> {
  let { data, error } = await sb
    .from('messages')
    .select(SEL_FULL)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error && isMissingChatColumnsError(error)) {
    const r2 = await sb
      .from('messages')
      .select(SEL_BASE)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    data = r2.data;
    error = r2.error;
  }

  if (error) {
    return {
      data: [],
      error: [error.message, (error as { details?: string }).details].filter(Boolean).join(' — ') || 'Erro ao carregar mensagens.',
    };
  }
  return { data: (data ?? []) as ChatMessageRow[], error: null };
}

const MIGRATION_HINT =
  'Atualize o Supabase com a migration de anexos do chat (arquivo 20260410120000_chat_attachments_bucket_and_messages.sql) para enviar fotos e arquivos.';

export async function insertChatMessage(
  sb: Sb,
  params: {
    conversationId: string;
    senderId: string;
    content: string;
    messageKind: string;
    attachmentPath?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await sb.from('messages').insert({
    conversation_id: params.conversationId,
    sender_id: params.senderId,
    content: params.content,
    message_kind: params.messageKind,
    attachment_path: params.attachmentPath ?? null,
  });

  if (!error) return { ok: true };

  if (isMissingChatColumnsError(error)) {
    const textOnly = params.messageKind === 'text' && !params.attachmentPath;
    if (textOnly) {
      const r2 = await sb.from('messages').insert({
        conversation_id: params.conversationId,
        sender_id: params.senderId,
        content: params.content,
      });
      if (r2.error) {
        return { ok: false, error: r2.error.message ?? 'Falha ao enviar mensagem.' };
      }
      return { ok: true };
    }
    return { ok: false, error: MIGRATION_HINT };
  }

  return { ok: false, error: error.message ?? 'Falha ao enviar mensagem.' };
}
