-- Regra de produto revisada (Fase 1):
--   CLIENTE escolhe motorista → MOTORISTA aceita/recusa SEMPRE primeiro
--     → se recusa: cancela + estorna (fluxo atual de shipment_driver_pass_offer).
--     → se aceita:
--         • sem base: motorista coleta na casa do cliente e entrega no destino.
--         • com base: PREPARADOR da base coleta na casa do cliente, leva à base;
--                     depois MOTORISTA retira na base e entrega no destino.
--
-- A versão anterior do banco fazia "preparador primeiro" quando havia base, ou seja:
--   - `shipment_begin_driver_offering` retornava { skipped, reason: hub_preparer_first }
--     se `base_id IS NOT NULL` → o motorista preferido nunca recebia a oferta.
--   - O helper novo `shipment_open_driver_offer_queue_internal` tinha o mesmo guarda.
--   - `preparer_shipment_queue()` listava envios com `driver_id IS NULL` → preparador
--     via antes do motorista aceitar.
--   - A RLS `drivers_can_view_shipments` exigia `base_id IS NULL` nos ramos
--     via-trip / current_offer / preferred-before-offer.
--
-- Esta migration inverte esses pontos sem introduzir novo status: motorista aceita
-- sempre primeiro (com ou sem base), e o preparador só vê `driver_id IS NOT NULL`.
-- A notificação "Retire o pacote na base (hub) da região" já existente em
-- `shipment_driver_accept_offer` cobre o caso com base, e a Fase 2 detalhará a
-- jornada pós-aceite com novas colunas/UI.

-- ===========================================================================
-- 1) RPC `shipment_begin_driver_offering` — remove o short-circuit "hub_preparer_first"
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.shipment_begin_driver_offering(p_shipment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.shipments%ROWTYPE;
  q uuid[] := '{}';
  q_ordered uuid[] := '{}';
  d uuid;
  pref uuid;
  r record;
  n int;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = p_shipment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'shipment_not_found');
  END IF;
  IF s.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF s.driver_id IS NOT NULL OR s.driver_offer_index >= 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;
  IF s.client_preferred_driver_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_preferred_driver');
  END IF;

  -- Pagamento online ainda não confirmado: trigger abrirá quando webhook gravar o PI.
  IF lower(coalesce(s.payment_method, '')) IN ('credito', 'debito', 'pix')
     AND (s.stripe_payment_intent_id IS NULL OR btrim(s.stripe_payment_intent_id) = '')
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_required');
  END IF;

  pref := s.client_preferred_driver_id;

  FOR r IN
    SELECT st.driver_id, st.departure_at, coalesce(st.badge, '') AS badge
    FROM public.scheduled_trips st
    WHERE st.status = 'active'
      AND st.is_active IS TRUE
      AND st.driver_journey_started_at IS NULL
      AND st.departure_at > now()
      AND st.seats_available > 0
      AND public.shipment_same_route_as_trip(
        s.origin_lat, s.origin_lng, s.destination_lat, s.destination_lng,
        st.origin_lat, st.origin_lng, st.destination_lat, st.destination_lng
      )
    ORDER BY st.departure_at ASC,
      CASE WHEN coalesce(st.badge, '') = 'Take Me' THEN 0 ELSE 1 END ASC
  LOOP
    IF NOT (r.driver_id = ANY (q)) THEN
      q := array_append(q, r.driver_id);
    END IF;
  END LOOP;

  n := coalesce(array_length(q, 1), 0);
  IF n = 0 THEN
    UPDATE public.shipments
    SET
      status = 'cancelled',
      cancellation_reason = 'no_driver_accepted',
      current_offer_driver_id = NULL,
      current_offer_expires_at = NULL,
      driver_offer_queue = '{}',
      driver_offer_index = -1
    WHERE id = p_shipment_id;
    RETURN jsonb_build_object('ok', true, 'cancelled', true, 'reason', 'no_matching_route');
  END IF;

  q_ordered := array_append(q_ordered, pref);
  FOREACH d IN ARRAY q LOOP
    IF d IS DISTINCT FROM pref THEN
      q_ordered := array_append(q_ordered, d);
    END IF;
  END LOOP;
  q := q_ordered;

  UPDATE public.shipments
  SET
    driver_offer_queue = q,
    driver_offer_index = 0,
    current_offer_driver_id = q[1],
    current_offer_expires_at = now() + interval '30 minutes'
  WHERE id = p_shipment_id;

  RETURN jsonb_build_object('ok', true, 'queue_length', coalesce(array_length(q, 1), 0));
END;
$$;

COMMENT ON FUNCTION public.shipment_begin_driver_offering(uuid) IS
  'Abre a fila sequencial de motoristas. Sempre executa, mesmo com base_id (motorista aceita primeiro; preparador atua após o aceite quando há base).';

-- ===========================================================================
-- 2) Helper interno e trigger auto-open — também sem guarda de base
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.shipment_open_driver_offer_queue_internal(
  p_shipment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.shipments%ROWTYPE;
  q uuid[] := '{}';
  q_ordered uuid[] := '{}';
  d uuid;
  pref uuid;
  r record;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF s.driver_id IS NOT NULL THEN RETURN; END IF;
  IF s.driver_offer_index IS NOT NULL AND s.driver_offer_index >= 0 THEN RETURN; END IF;
  IF s.client_preferred_driver_id IS NULL THEN RETURN; END IF;
  IF s.status IS NULL OR s.status NOT IN ('pending_review', 'confirmed') THEN RETURN; END IF;

  IF lower(coalesce(s.payment_method, '')) IN ('credito', 'debito', 'pix')
     AND (s.stripe_payment_intent_id IS NULL OR btrim(s.stripe_payment_intent_id) = '')
  THEN
    RETURN;
  END IF;

  pref := s.client_preferred_driver_id;

  FOR r IN
    SELECT st.driver_id, st.departure_at, coalesce(st.badge, '') AS badge
    FROM public.scheduled_trips st
    WHERE st.status = 'active'
      AND st.is_active IS TRUE
      AND st.driver_journey_started_at IS NULL
      AND st.departure_at > now()
      AND st.seats_available > 0
      AND public.shipment_same_route_as_trip(
        s.origin_lat, s.origin_lng, s.destination_lat, s.destination_lng,
        st.origin_lat, st.origin_lng, st.destination_lat, st.destination_lng
      )
    ORDER BY st.departure_at ASC,
      CASE WHEN coalesce(st.badge, '') = 'Take Me' THEN 0 ELSE 1 END ASC
  LOOP
    IF NOT (r.driver_id = ANY (q)) THEN
      q := array_append(q, r.driver_id);
    END IF;
  END LOOP;

  IF coalesce(array_length(q, 1), 0) = 0 THEN
    UPDATE public.shipments
    SET
      status = 'cancelled',
      cancellation_reason = 'no_driver_accepted',
      current_offer_driver_id = NULL,
      current_offer_expires_at = NULL,
      driver_offer_queue = '{}',
      driver_offer_index = -1
    WHERE id = p_shipment_id;
    RETURN;
  END IF;

  q_ordered := array_append(q_ordered, pref);
  FOREACH d IN ARRAY q LOOP
    IF d IS DISTINCT FROM pref THEN
      q_ordered := array_append(q_ordered, d);
    END IF;
  END LOOP;
  q := q_ordered;

  UPDATE public.shipments
  SET
    driver_offer_queue = q,
    driver_offer_index = 0,
    current_offer_driver_id = q[1],
    current_offer_expires_at = now() + interval '30 minutes'
  WHERE id = p_shipment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_shipment_auto_open_driver_offer_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_preferred_driver_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.driver_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.driver_offer_index IS NOT NULL AND NEW.driver_offer_index >= 0 THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NULL OR NEW.status NOT IN ('pending_review', 'confirmed') THEN
    RETURN NEW;
  END IF;

  IF lower(coalesce(NEW.payment_method, '')) IN ('credito', 'debito', 'pix')
     AND (NEW.stripe_payment_intent_id IS NULL OR btrim(NEW.stripe_payment_intent_id) = '')
  THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND (
          OLD.status IS DISTINCT FROM NEW.status
          OR OLD.stripe_payment_intent_id IS DISTINCT FROM NEW.stripe_payment_intent_id
          OR OLD.client_preferred_driver_id IS DISTINCT FROM NEW.client_preferred_driver_id
          OR OLD.base_id IS DISTINCT FROM NEW.base_id
          OR OLD.driver_offer_index IS DISTINCT FROM NEW.driver_offer_index
     ))
  THEN
    BEGIN
      PERFORM public.shipment_open_driver_offer_queue_internal(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[trg_shipment_auto_open_driver_offer_queue] ignorado: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- ===========================================================================
-- 3) Fila do preparador — agora só mostra envios já aceitos pelo motorista
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.preparer_shipment_queue()
RETURNS SETOF public.shipments
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM public.shipments s
  INNER JOIN public.worker_profiles wp
    ON wp.id = auth.uid()
   AND wp.subtype = 'shipments'
   AND wp.base_id IS NOT NULL
   AND wp.base_id = s.base_id
  WHERE s.driver_id IS NOT NULL
    AND s.status IN ('pending_review', 'confirmed')
    AND s.base_id IS NOT NULL
  ORDER BY s.driver_accepted_at DESC NULLS LAST, s.created_at DESC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.preparer_shipment_queue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preparer_shipment_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.preparer_shipment_queue() TO service_role;

COMMENT ON FUNCTION public.preparer_shipment_queue() IS
  'Fila do preparador: mesma base, motorista já aceitou (driver_id NOT NULL), status operacional.';

-- ===========================================================================
-- 4) RLS `drivers_can_view_shipments` e `drivers_can_update_shipments`
--    - Ramo preparador agora exige `driver_id IS NOT NULL`.
--    - Ramos motorista (via-trip, current_offer, preferred-before-offer) passam
--      a aceitar envios com `base_id` preenchido.
-- ===========================================================================
DROP POLICY IF EXISTS "drivers_can_view_shipments" ON public.shipments;
DROP POLICY IF EXISTS "drivers_can_update_shipments" ON public.shipments;

CREATE POLICY "drivers_can_view_shipments"
  ON public.shipments
  FOR SELECT
  USING (
    status = 'pending_review'
    OR driver_id = auth.uid()
    OR user_id = auth.uid()
    OR (
      driver_id IS NOT NULL
      AND status IN ('confirmed', 'in_progress')
      AND base_id IS NOT NULL
      AND public.worker_is_shipments_preparer_for_base(shipments.base_id)
    )
    OR (
      shipments.scheduled_trip_id IS NOT NULL
      AND shipments.driver_id IS NULL
      AND shipments.status IN ('pending_review', 'confirmed')
      AND public.auth_is_driver_of_scheduled_trip(shipments.scheduled_trip_id)
    )
    OR (
      shipments.driver_id IS NULL
      AND shipments.status = 'confirmed'
      AND shipments.current_offer_driver_id = auth.uid()
    )
    OR (
      shipments.driver_id IS NULL
      AND shipments.status = 'confirmed'
      AND shipments.client_preferred_driver_id = auth.uid()
      AND shipments.current_offer_driver_id IS NULL
    )
  );

CREATE POLICY "drivers_can_update_shipments"
  ON public.shipments
  FOR UPDATE
  USING (
    status = 'pending_review'
    OR driver_id = auth.uid()
    OR (
      driver_id IS NOT NULL
      AND status IN ('confirmed', 'in_progress')
      AND base_id IS NOT NULL
      AND public.worker_is_shipments_preparer_for_base(shipments.base_id)
    )
    OR (
      shipments.scheduled_trip_id IS NOT NULL
      AND shipments.driver_id IS NULL
      AND shipments.status IN ('pending_review', 'confirmed')
      AND public.auth_is_driver_of_scheduled_trip(shipments.scheduled_trip_id)
    )
  );

COMMENT ON POLICY "drivers_can_view_shipments" ON public.shipments IS
  'Motorista vê envios mesmo com base (para aceitar/recusar); preparador só vê após aceite (driver_id NOT NULL).';

-- ===========================================================================
-- 5) Backfill: envios órfãos que o modelo antigo deixou presos com base
--    agora ganham fila aberta. O helper interno revalida todos os guards.
-- ===========================================================================
DO $$
DECLARE
  shp uuid;
BEGIN
  FOR shp IN
    SELECT id
    FROM public.shipments
    WHERE driver_id IS NULL
      AND (driver_offer_index IS NULL OR driver_offer_index < 0)
      AND client_preferred_driver_id IS NOT NULL
      AND status IN ('pending_review', 'confirmed')
      AND (
        lower(coalesce(payment_method, '')) NOT IN ('credito', 'debito', 'pix')
        OR (stripe_payment_intent_id IS NOT NULL AND btrim(stripe_payment_intent_id) <> '')
      )
  LOOP
    BEGIN
      PERFORM public.shipment_open_driver_offer_queue_internal(shp);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[backfill shipment_open_driver_offer_queue_internal] % : %', shp, SQLERRM;
    END;
  END LOOP;
END $$;
