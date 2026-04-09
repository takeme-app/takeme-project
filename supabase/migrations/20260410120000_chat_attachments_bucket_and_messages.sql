-- Anexos de chat (imagens, áudio, arquivos): bucket privado + colunas em messages.
-- Path no storage: {conversation_id}/{nome único}.{ext}

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "chat_attachments read participants" ON storage.objects;
CREATE POLICY "chat_attachments read participants"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = split_part(name, '/', 1)
        AND (c.driver_id = auth.uid() OR c.client_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "chat_attachments insert participants" ON storage.objects;
CREATE POLICY "chat_attachments insert participants"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = split_part(name, '/', 1)
        AND (c.driver_id = auth.uid() OR c.client_id = auth.uid())
        AND c.status = 'active'
    )
  );

DROP POLICY IF EXISTS "chat_attachments delete participants" ON storage.objects;
CREATE POLICY "chat_attachments delete participants"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = split_part(name, '/', 1)
        AND (c.driver_id = auth.uid() OR c.client_id = auth.uid())
    )
  );

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_kind text NOT NULL DEFAULT 'text';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_message_kind_check'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_message_kind_check
      CHECK (message_kind IN ('text', 'image', 'audio', 'file'));
  END IF;
END $$;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_path text;

COMMENT ON COLUMN public.messages.message_kind IS 'text | image | audio | file';
COMMENT ON COLUMN public.messages.attachment_path IS 'Caminho no bucket chat-attachments (conversation_id/arquivo).';

CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  preview text;
BEGIN
  preview := CASE NEW.message_kind
    WHEN 'image' THEN COALESCE(NULLIF(trim(NEW.content), ''), '📷 Foto')
    WHEN 'audio' THEN COALESCE(NULLIF(trim(NEW.content), ''), '🎤 Áudio')
    WHEN 'file' THEN COALESCE(NULLIF(trim(NEW.content), ''), '📎 Arquivo')
    ELSE NEW.content
  END;

  UPDATE public.conversations
  SET
    last_message     = preview,
    last_message_at  = NEW.created_at,
    unread_driver    = CASE WHEN NEW.sender_id = client_id  THEN unread_driver + 1 ELSE 0 END,
    unread_client    = CASE WHEN NEW.sender_id = driver_id THEN unread_client + 1 ELSE 0 END,
    updated_at       = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
