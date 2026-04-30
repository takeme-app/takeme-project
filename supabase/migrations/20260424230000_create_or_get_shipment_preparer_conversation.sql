-- Chat preparador ↔ cliente: o app não pode confiar só no SELECT com RLS, pois pode já existir
-- uma conversa ativa para o mesmo `shipment_id` (ex.: `driver_id` = motorista) e o preparador
-- não enxerga a linha → INSERT duplicado em `conversations_one_active_per_shipment`.
--
-- Esta RPC (SECURITY DEFINER) devolve a conversa existente ou cria uma nova, e realinha
-- `conversations.driver_id` para o preparador que assumiu a coleta (`shipments.preparer_id`).

CREATE OR REPLACE FUNCTION public.create_or_get_shipment_preparer_conversation(p_shipment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid uuid;
  client_uuid uuid;
  cname text;
  cavatar text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.shipments s
    WHERE s.id = p_shipment_id
      AND s.preparer_id = auth.uid()
      AND s.base_id IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT c.id INTO cid
  FROM public.conversations c
  WHERE c.shipment_id = p_shipment_id
    AND c.status = 'active'
  LIMIT 1;

  IF cid IS NOT NULL THEN
    UPDATE public.conversations c
    SET
      driver_id = auth.uid(),
      participant_name = COALESCE(
        NULLIF(btrim(c.participant_name), ''),
        (
          SELECT COALESCE(NULLIF(btrim(p.full_name), ''), 'Cliente')
          FROM public.profiles p
          WHERE p.id = c.client_id
          LIMIT 1
        )
      ),
      updated_at = now()
    WHERE c.id = cid;

    RETURN jsonb_build_object('ok', true, 'conversation_id', cid);
  END IF;

  SELECT s.user_id INTO client_uuid FROM public.shipments s WHERE s.id = p_shipment_id;
  IF client_uuid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'shipment_not_found');
  END IF;
  IF client_uuid = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_client');
  END IF;

  SELECT COALESCE(NULLIF(btrim(full_name), ''), 'Cliente'), avatar_url
  INTO cname, cavatar
  FROM public.profiles
  WHERE id = client_uuid;

  INSERT INTO public.conversations (
    driver_id,
    client_id,
    shipment_id,
    participant_name,
    participant_avatar,
    status
  )
  VALUES (
    auth.uid(),
    client_uuid,
    p_shipment_id,
    COALESCE(cname, 'Cliente'),
    cavatar,
    'active'
  )
  RETURNING id INTO cid;

  RETURN jsonb_build_object('ok', true, 'conversation_id', cid);
EXCEPTION
  WHEN unique_violation THEN
    SELECT c2.id INTO cid
    FROM public.conversations c2
    WHERE c2.shipment_id = p_shipment_id
      AND c2.status = 'active'
    LIMIT 1;

    IF cid IS NULL THEN
      RAISE;
    END IF;

    UPDATE public.conversations c
    SET
      driver_id = auth.uid(),
      participant_name = COALESCE(
        NULLIF(btrim(c.participant_name), ''),
        (
          SELECT COALESCE(NULLIF(btrim(p.full_name), ''), 'Cliente')
          FROM public.profiles p
          WHERE p.id = c.client_id
          LIMIT 1
        )
      ),
      updated_at = now()
    WHERE c.id = cid;

    RETURN jsonb_build_object('ok', true, 'conversation_id', cid);
END;
$$;

REVOKE ALL ON FUNCTION public.create_or_get_shipment_preparer_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_or_get_shipment_preparer_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_get_shipment_preparer_conversation(uuid) TO service_role;

COMMENT ON FUNCTION public.create_or_get_shipment_preparer_conversation(uuid) IS
  'Idempotente: retorna ou cria conversa ativa do envio e associa driver_id ao preparador (auth.uid()).';
