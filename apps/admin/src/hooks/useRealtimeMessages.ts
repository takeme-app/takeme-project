import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ── Types ────────────────────────────────────────────────────────────
export interface RealtimeMessage {
  id: string;
  sender_id: string;
  content: string;
  attachment_url: string | null;
  attachment_type: string | null;
  created_at: string;
  read_at: string | null;
}

interface UseRealtimeMessagesOptions {
  conversationId: string | null;
  /** Limite inicial de mensagens (default 50) */
  initialLimit?: number;
}

interface UseRealtimeMessagesReturn {
  messages: RealtimeMessage[];
  loading: boolean;
  error: string | null;
  /** Envia uma mensagem de texto */
  sendMessage: (content: string, attachmentUrl?: string, attachmentType?: string) => Promise<void>;
  /** Marca mensagens como lidas */
  markAsRead: () => Promise<void>;
  /** Recarrega mensagens */
  refresh: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────
export function useRealtimeMessages(opts: UseRealtimeMessagesOptions): UseRealtimeMessagesReturn {
  const { conversationId, initialLimit = 50 } = opts;
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  // Buscar mensagens iniciais
  const fetchMessages = useCallback(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    (supabase as any)
      .from('messages')
      .select('id, sender_id, content, attachment_url, attachment_type, created_at, read_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(initialLimit)
      .then(({ data, error: err }: any) => {
        if (err) {
          setError(err.message);
        } else {
          setMessages(data || []);
          setError(null);
        }
        setLoading(false);
      });
  }, [conversationId, initialLimit]);

  // Fetch inicial
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = (supabase as any)
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: any) => {
          const newMsg: RealtimeMessage = payload.new;
          setMessages((prev) => {
            // Evitar duplicatas
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        (supabase as any).removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId]);

  // Enviar mensagem
  const sendMessage = useCallback(
    async (content: string, attachmentUrl?: string, attachmentType?: string) => {
      if (!conversationId) return;

      const { data: session } = await (supabase as any).auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) return;

      const insertData: any = {
        conversation_id: conversationId,
        sender_id: userId,
        content,
      };
      if (attachmentUrl) insertData.attachment_url = attachmentUrl;
      if (attachmentType) insertData.attachment_type = attachmentType;

      const { error: err } = await (supabase as any).from('messages').insert(insertData);
      if (err) setError(err.message);

      // Atualizar last_message na conversa
      await (supabase as any)
        .from('conversations')
        .update({
          last_message: content || (attachmentType === 'pdf' ? 'Arquivo PDF' : 'Imagem'),
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversationId);
    },
    [conversationId],
  );

  // Marcar como lidas
  const markAsRead = useCallback(async () => {
    if (!conversationId) return;

    const { data: session } = await (supabase as any).auth.getSession();
    const userId = session?.session?.user?.id;
    if (!userId) return;

    await (supabase as any)
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .is('read_at', null);
  }, [conversationId]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
    refresh: fetchMessages,
  };
}
