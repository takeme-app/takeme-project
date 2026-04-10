-- Atendimento backoffice: conversas de suporte, SLA 1 dia, vínculo admin, atribuição automática.
-- Estende worker_profiles.subtype para staff (admin/suporte/financeiro).

-- ── worker_profiles.subtype (backoffice) ───────────────────────────────
ALTER TABLE public.worker_profiles DROP CONSTRAINT IF EXISTS worker_profiles_subtype_check;
ALTER TABLE public.worker_profiles
  ADD CONSTRAINT worker_profiles_subtype_check CHECK (
    subtype = ANY (
      ARRAY[
        'takeme'::text,
        'partner'::text,
        'shipments'::text,
        'excursions'::text,
        'admin'::text,
        'suporte'::text,
        'financeiro'::text
      ]
    )
  );

-- ── conversations: suporte vs motorista/cliente ───────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS conversation_kind text NOT NULL DEFAULT 'driver_client';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_conversation_kind_check'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_conversation_kind_check
      CHECK (conversation_kind IN ('driver_client', 'support_backoffice'));
  END IF;
END $$;

ALTER TABLE public.conversations ALTER COLUMN driver_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_driver_client_requires_driver'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_driver_client_requires_driver
      CHECK (
        (conversation_kind = 'driver_client' AND driver_id IS NOT NULL)
        OR (conversation_kind = 'support_backoffice')
      );
  END IF;
END $$;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS sla_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS finish_note text;

COMMENT ON COLUMN public.conversations.conversation_kind IS 'driver_client: chat motorista↔cliente; support_backoffice: fila de atendimento (driver_id opcional).';
COMMENT ON COLUMN public.conversations.admin_id IS 'Operador de suporte/backoffice atribuído ao ticket.';
COMMENT ON COLUMN public.conversations.category IS 'excursao | encomendas | reembolso | cadastro_transporte | autorizar_menores | ouvidoria | denuncia | outros';
COMMENT ON COLUMN public.conversations.context IS 'Metadados do ticket (excursion_request_id, booking_id, shipment_id, complaint, etc.).';

CREATE INDEX IF NOT EXISTS idx_conversations_admin_status
  ON public.conversations (admin_id, status)
  WHERE conversation_kind = 'support_backoffice';

CREATE INDEX IF NOT EXISTS idx_conversations_category_status
  ON public.conversations (category, status)
  WHERE conversation_kind = 'support_backoffice';

CREATE INDEX IF NOT EXISTS idx_conversations_client_support_created
  ON public.conversations (client_id, created_at DESC)
  WHERE conversation_kind = 'support_backoffice';

-- ── SLA: 1 dia após abertura (support) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_support_conversation_sla()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.conversation_kind = 'support_backoffice' AND NEW.sla_deadline_at IS NULL THEN
    NEW.sla_deadline_at := COALESCE(NEW.created_at, now()) + interval '1 day';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conversations_support_sla ON public.conversations;
CREATE TRIGGER trg_conversations_support_sla
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_support_conversation_sla();

-- ── Atribuição: suporte com menos tickets ativos + random em empate ───
CREATE OR REPLACE FUNCTION public.assign_support_agent(p_conversation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_chosen uuid;
  v_existing uuid;
BEGIN
  SELECT admin_id INTO v_existing
  FROM public.conversations
  WHERE id = p_conversation_id;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  WITH eligible AS (
    SELECT wp.id,
           (
             SELECT COUNT(*)::int
             FROM public.conversations cc
             WHERE cc.conversation_kind = 'support_backoffice'
               AND cc.status = 'active'
               AND cc.admin_id = wp.id
           ) AS active_cnt
    FROM public.worker_profiles wp
    WHERE wp.role = 'admin'
      AND wp.subtype = 'suporte'
      AND wp.status = 'approved'
  ),
  picked AS (
    SELECT e.id
    FROM eligible e
    WHERE e.active_cnt = (SELECT MIN(e2.active_cnt) FROM eligible e2)
    ORDER BY random()
    LIMIT 1
  )
  SELECT id INTO v_chosen FROM picked;

  IF v_chosen IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.conversations
  SET admin_id = v_chosen,
      assigned_at = now(),
      updated_at = now()
  WHERE id = p_conversation_id
    AND conversation_kind = 'support_backoffice'
    AND admin_id IS NULL;

  RETURN v_chosen;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_conversations_support_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.conversation_kind = 'support_backoffice' AND NEW.admin_id IS NULL THEN
    PERFORM public.assign_support_agent(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conversations_support_assign ON public.conversations;
CREATE TRIGGER trg_conversations_support_assign
  AFTER INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_conversations_support_assign();

-- ── RPC: abrir ticket de suporte (cliente autenticado) ─────────────────
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
    last_message_at
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
    now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.open_support_ticket(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_support_ticket(text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.open_support_ticket IS 'Cria conversa de suporte; driver_id=client_id satisfaz FK até haver placeholder dedicado.';

-- ── RPC: claim ticket (suporte/admin) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_support_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.conversations
  SET admin_id = v_uid,
      assigned_at = now(),
      updated_at = now()
  WHERE id = p_conversation_id
    AND conversation_kind = 'support_backoffice'
    AND status = 'active';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_support_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_support_conversation(uuid) TO authenticated;

-- ── handle_new_message: driver_id nulo (suporte) ───────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  preview text;
  v_driver uuid;
  v_client uuid;
BEGIN
  SELECT c.driver_id, c.client_id INTO v_driver, v_client
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id;

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

-- ── Quem pode atualizar ticket de suporte (por subtype) ───────────────
CREATE OR REPLACE FUNCTION public.admin_may_update_support_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  r RECORD;
  sub text;
BEGIN
  SELECT conversation_kind, category, admin_id
  INTO r
  FROM public.conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND OR r.conversation_kind <> 'support_backoffice' THEN
    RETURN false;
  END IF;

  SELECT wp.subtype INTO sub
  FROM public.worker_profiles wp
  WHERE wp.id = auth.uid()
    AND wp.role = 'admin'
    AND wp.status = 'approved';

  IF sub IS NULL THEN
    RETURN false;
  END IF;

  IF sub = 'admin' THEN
    RETURN true;
  END IF;

  IF sub = 'financeiro' AND r.category = 'reembolso' THEN
    RETURN true;
  END IF;

  IF sub = 'suporte' AND (r.admin_id IS NULL OR r.admin_id = auth.uid()) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ── RLS: admin em conversas de suporte ────────────────────────────────
DROP POLICY IF EXISTS "conversations_select_admin_support" ON public.conversations;
CREATE POLICY "conversations_select_admin_support"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND conversation_kind = 'support_backoffice'
  );

DROP POLICY IF EXISTS "conversations_update_admin_support" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_support_own" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_support_roles" ON public.conversations;

CREATE POLICY "conversations_update_support_roles"
  ON public.conversations FOR UPDATE TO authenticated
  USING (public.admin_may_update_support_conversation(id))
  WITH CHECK (public.admin_may_update_support_conversation(id));

-- Mensagens: admin em tickets de suporte
DROP POLICY IF EXISTS "messages_select_admin_support" ON public.messages;
CREATE POLICY "messages_select_admin_support"
  ON public.messages FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.conversation_kind = 'support_backoffice'
    )
  );

DROP POLICY IF EXISTS "messages_insert_admin_support" ON public.messages;
CREATE POLICY "messages_insert_admin_support"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    AND auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.conversation_kind = 'support_backoffice'
        AND c.status = 'active'
    )
  );

DROP POLICY IF EXISTS "messages_update_admin_support" ON public.messages;
CREATE POLICY "messages_update_admin_support"
  ON public.messages FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.conversation_kind = 'support_backoffice'
    )
  );

-- Storage chat-attachments: admin em conversa de suporte
DROP POLICY IF EXISTS "chat_attachments read admin support" ON storage.objects;
CREATE POLICY "chat_attachments read admin support"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = split_part(name, '/', 1)
        AND c.conversation_kind = 'support_backoffice'
    )
  );

DROP POLICY IF EXISTS "chat_attachments insert admin support" ON storage.objects;
CREATE POLICY "chat_attachments insert admin support"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = split_part(name, '/', 1)
        AND c.conversation_kind = 'support_backoffice'
        AND c.status = 'active'
    )
  );

DROP POLICY IF EXISTS "chat_attachments delete admin support" ON storage.objects;
CREATE POLICY "chat_attachments delete admin support"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = split_part(name, '/', 1)
        AND c.conversation_kind = 'support_backoffice'
    )
  );
