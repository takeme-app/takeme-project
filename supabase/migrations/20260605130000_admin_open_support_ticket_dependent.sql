-- Estende admin_open_support_ticket_for_entity: envio dependente (context.dependent_shipment_id) e assinatura com 5º parâmetro.

DROP FUNCTION IF EXISTS public.admin_open_support_ticket_for_entity(uuid, uuid, text, jsonb);

CREATE OR REPLACE FUNCTION public.admin_open_support_ticket_for_entity(
  p_booking_id uuid DEFAULT NULL,
  p_shipment_id uuid DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_context jsonb DEFAULT '{}'::jsonb,
  p_dependent_shipment_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_client uuid;
  v_name text;
  v_id uuid;
  v_existing uuid;
  v_cat text;
  v_ctx jsonb;
  v_entity_count int;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_entity_count :=
    (CASE WHEN p_booking_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN p_shipment_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN p_dependent_shipment_id IS NOT NULL THEN 1 ELSE 0 END);

  IF v_entity_count <> 1 THEN
    RAISE EXCEPTION 'exactly_one_entity_required';
  END IF;

  IF p_booking_id IS NOT NULL THEN
    SELECT b.user_id INTO v_client FROM public.bookings b WHERE b.id = p_booking_id;
    IF v_client IS NULL THEN
      RAISE EXCEPTION 'booking_not_found';
    END IF;

    SELECT c.id INTO v_existing
    FROM public.conversations c
    WHERE c.conversation_kind = 'support_backoffice'
      AND c.status = 'active'
      AND c.booking_id IS NOT DISTINCT FROM p_booking_id
    ORDER BY c.created_at DESC NULLS LAST
    LIMIT 1;
  ELSIF p_shipment_id IS NOT NULL THEN
    SELECT s.user_id INTO v_client FROM public.shipments s WHERE s.id = p_shipment_id;
    IF v_client IS NULL THEN
      RAISE EXCEPTION 'shipment_not_found';
    END IF;

    SELECT c.id INTO v_existing
    FROM public.conversations c
    WHERE c.conversation_kind = 'support_backoffice'
      AND c.status = 'active'
      AND c.shipment_id IS NOT DISTINCT FROM p_shipment_id
    ORDER BY c.created_at DESC NULLS LAST
    LIMIT 1;
  ELSE
    SELECT ds.user_id INTO v_client FROM public.dependent_shipments ds WHERE ds.id = p_dependent_shipment_id;
    IF v_client IS NULL THEN
      RAISE EXCEPTION 'dependent_shipment_not_found';
    END IF;

    SELECT c.id INTO v_existing
    FROM public.conversations c
    WHERE c.conversation_kind = 'support_backoffice'
      AND c.status = 'active'
      AND (c.context->>'dependent_shipment_id') IS NOT DISTINCT FROM p_dependent_shipment_id::text
    ORDER BY c.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  v_cat :=
    COALESCE(
      NULLIF(trim(p_category), ''),
      CASE
        WHEN p_shipment_id IS NOT NULL OR p_dependent_shipment_id IS NOT NULL THEN 'encomendas'
        ELSE 'outros'
      END
    );

  SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.id = v_client;

  v_ctx :=
    COALESCE(p_context, '{}'::jsonb)
    || jsonb_build_object(
      'opened_from_admin_backoffice', true,
      'opened_by_admin_user_id', v_admin::text
    );

  IF p_dependent_shipment_id IS NOT NULL THEN
    v_ctx := v_ctx || jsonb_build_object('dependent_shipment_id', p_dependent_shipment_id::text);
  END IF;

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
    NULL,
    v_client,
    p_booking_id,
    p_shipment_id,
    'active',
    'support_backoffice',
    v_cat,
    v_ctx,
    COALESCE(v_name, 'Cliente'),
    'Ticket aberto pelo backoffice',
    now(),
    v_client
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_open_support_ticket_for_entity(uuid, uuid, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_open_support_ticket_for_entity(uuid, uuid, text, jsonb, uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_open_support_ticket_for_entity(uuid, uuid, text, jsonb, uuid) IS
  'Admin only: ticket support_backoffice para booking_id, shipment_id ou dependent_shipment_id (via context).';
