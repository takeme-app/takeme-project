-- Suporte: requester explícito + contadores quando driver_id = client_id (ticket open_support_ticket).

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS support_requester_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.conversations.support_requester_id IS 'Quem abriu o ticket de suporte (auth.users); complementa driver_id/client_id.';

UPDATE public.conversations
SET support_requester_id = driver_id
WHERE conversation_kind = 'support_backoffice'
  AND support_requester_id IS NULL
  AND driver_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.open_support_ticket(
  p_category text,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_name text;
  v_booking uuid;
  v_shipment uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_category IS NULL OR btrim(p_category) = '' THEN
    RAISE EXCEPTION 'category_required';
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_uid;

  BEGIN
    v_booking := (p_context->>'booking_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_booking := NULL;
  END;

  BEGIN
    v_shipment := (p_context->>'shipment_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_shipment := NULL;
  END;

  INSERT INTO public.conversations (
    driver_id,
    client_id,
    booking_id,
    shipment_id,
    status,
    conversation_kind,
    category,
    context,
    participant_name,
    last_message,
    last_message_at,
    support_requester_id
  ) VALUES (
    v_uid,
    v_uid,
    v_booking,
    v_shipment,
    'active',
    'support_backoffice',
    p_category,
    COALESCE(p_context, '{}'::jsonb),
    COALESCE(v_name, 'Cliente'),
    'Solicitação de atendimento',
    now(),
    v_uid
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  preview text;
  v_driver uuid;
  v_client uuid;
  v_kind text;
BEGIN
  SELECT c.driver_id, c.client_id, c.conversation_kind
  INTO v_driver, v_client, v_kind
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id;

  preview := CASE NEW.message_kind
    WHEN 'image' THEN COALESCE(NULLIF(trim(NEW.content), ''), '📷 Foto')
    WHEN 'audio' THEN COALESCE(NULLIF(trim(NEW.content), ''), '🎤 Áudio')
    WHEN 'file' THEN COALESCE(NULLIF(trim(NEW.content), ''), '📎 Arquivo')
    ELSE NEW.content
  END;

  IF v_kind = 'support_backoffice'
     AND v_driver IS NOT NULL
     AND v_client IS NOT NULL
     AND v_driver = v_client THEN
    UPDATE public.conversations
    SET
      last_message     = preview,
      last_message_at  = NEW.created_at,
      unread_driver    = CASE
        WHEN NEW.sender_id IS DISTINCT FROM v_driver THEN unread_driver + 1
        ELSE 0
      END,
      unread_client    = CASE
        WHEN NEW.sender_id IS DISTINCT FROM v_client THEN unread_client + 1
        ELSE 0
      END,
      updated_at       = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
  END IF;

  UPDATE public.conversations
  SET
    last_message     = preview,
    last_message_at  = NEW.created_at,
    unread_driver    = CASE
      WHEN v_driver IS NULL THEN 0
      WHEN NEW.sender_id = v_client THEN unread_driver + 1
      ELSE 0
    END,
    unread_client    = CASE
      WHEN v_driver IS NOT NULL AND NEW.sender_id = v_driver THEN unread_client + 1
      WHEN v_driver IS NULL AND NEW.sender_id <> v_client THEN unread_client + 1
      ELSE 0
    END,
    updated_at       = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;
