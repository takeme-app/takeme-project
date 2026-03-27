-- ─── conversations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id         UUID        REFERENCES public.bookings(id) ON DELETE SET NULL,
  status             TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  -- denormalized for the conversations list
  participant_name   TEXT,
  participant_avatar TEXT,
  last_message       TEXT,
  last_message_at    TIMESTAMPTZ,
  unread_driver      INT         NOT NULL DEFAULT 0,
  unread_client      INT         NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content         TEXT        NOT NULL CHECK (content <> ''),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at         TIMESTAMPTZ
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;

-- conversations: driver or client can see their own
CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT USING (auth.uid() = driver_id OR auth.uid() = client_id);

CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = driver_id OR auth.uid() = client_id);

CREATE POLICY "conversations_update" ON public.conversations
  FOR UPDATE USING (auth.uid() = driver_id OR auth.uid() = client_id);

-- messages: only participants can read/write
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.driver_id = auth.uid() OR c.client_id = auth.uid())
    )
  );

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.driver_id = auth.uid() OR c.client_id = auth.uid())
        AND c.status = 'active'
    )
  );

-- ─── trigger: atualiza last_message e unread na conversations ─────────────────
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.conversations
  SET
    last_message     = NEW.content,
    last_message_at  = NEW.created_at,
    unread_driver    = CASE WHEN NEW.sender_id = client_id  THEN unread_driver + 1 ELSE 0            END,
    unread_client    = CASE WHEN NEW.sender_id = driver_id THEN unread_client + 1 ELSE 0            END,
    updated_at       = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER after_message_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();

-- view que o motorista usa (unread_count = mensagens não lidas pelo motorista)
CREATE OR REPLACE VIEW public.driver_conversations AS
  SELECT
    id,
    client_id,
    booking_id,
    status,
    participant_name,
    participant_avatar,
    last_message,
    last_message_at,
    unread_driver AS unread_count,
    created_at,
    updated_at,
    driver_id
  FROM public.conversations;
