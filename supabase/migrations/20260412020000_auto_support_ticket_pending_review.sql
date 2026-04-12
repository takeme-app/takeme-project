-- Auto-cria ticket de atendimento quando encomenda é criada com status pending_review.
-- O trigger trg_conversations_support_assign já existente faz o auto-assign do agente.

-- ─── Trigger function para shipments ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_auto_support_pending_review_shipment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.status <> 'pending_review' THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.conversations (
    driver_id,
    client_id,
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
    NEW.user_id,
    NEW.user_id,
    NEW.id,
    'active',
    'support_backoffice',
    'encomendas',
    jsonb_build_object(
      'shipment_id', NEW.id::text,
      'package_size', NEW.package_size,
      'shipment_kind', 'shipment'
    ),
    COALESCE(v_name, 'Cliente'),
    'Encomenda grande aguardando aprovação',
    now(),
    NEW.user_id
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_shipment_auto_support_pending_review ON public.shipments;
CREATE TRIGGER on_shipment_auto_support_pending_review
  AFTER INSERT ON public.shipments
  FOR EACH ROW
  WHEN (NEW.status = 'pending_review')
  EXECUTE FUNCTION public.trg_auto_support_pending_review_shipment();

-- ─── Trigger function para dependent_shipments ──────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_auto_support_pending_review_dep_shipment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.status <> 'pending_review' THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.conversations (
    driver_id,
    client_id,
    status,
    conversation_kind,
    category,
    context,
    participant_name,
    last_message,
    last_message_at,
    support_requester_id
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    'active',
    'support_backoffice',
    'encomendas',
    jsonb_build_object(
      'dependent_shipment_id', NEW.id::text,
      'shipment_kind', 'dependent_shipment'
    ),
    COALESCE(v_name, 'Cliente'),
    'Encomenda dependente aguardando aprovação',
    now(),
    NEW.user_id
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_dep_shipment_auto_support_pending_review ON public.dependent_shipments;
CREATE TRIGGER on_dep_shipment_auto_support_pending_review
  AFTER INSERT ON public.dependent_shipments
  FOR EACH ROW
  WHEN (NEW.status = 'pending_review')
  EXECUTE FUNCTION public.trg_auto_support_pending_review_dep_shipment();

-- ─── Backfill: criar tickets para pending_review existentes sem ticket ──────
INSERT INTO public.conversations (
  driver_id, client_id, shipment_id, status, conversation_kind, category,
  context, participant_name, last_message, last_message_at, support_requester_id
)
SELECT
  s.user_id,
  s.user_id,
  s.id,
  'active',
  'support_backoffice',
  'encomendas',
  jsonb_build_object('shipment_id', s.id::text, 'package_size', s.package_size, 'shipment_kind', 'shipment'),
  COALESCE(p.full_name, 'Cliente'),
  'Encomenda grande aguardando aprovação',
  now(),
  s.user_id
FROM public.shipments s
LEFT JOIN public.profiles p ON p.id = s.user_id
WHERE s.status = 'pending_review'
  AND NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.shipment_id = s.id
      AND c.conversation_kind = 'support_backoffice'
      AND c.status = 'active'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.conversations (
  driver_id, client_id, status, conversation_kind, category,
  context, participant_name, last_message, last_message_at, support_requester_id
)
SELECT
  d.user_id,
  d.user_id,
  'active',
  'support_backoffice',
  'encomendas',
  jsonb_build_object('dependent_shipment_id', d.id::text, 'shipment_kind', 'dependent_shipment'),
  COALESCE(p.full_name, 'Cliente'),
  'Encomenda dependente aguardando aprovação',
  now(),
  d.user_id
FROM public.dependent_shipments d
LEFT JOIN public.profiles p ON p.id = d.user_id
WHERE d.status = 'pending_review'
  AND NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.conversation_kind = 'support_backoffice'
      AND c.status = 'active'
      AND c.context->>'dependent_shipment_id' = d.id::text
  )
ON CONFLICT DO NOTHING;
