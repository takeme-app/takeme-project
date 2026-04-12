-- Fila de motoristas para envios (mesma rota origem+destino), oferta sequencial 3 min, preparador só após aceite com base.

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS origin_city text,
  ADD COLUMN IF NOT EXISTS client_preferred_driver_id uuid REFERENCES auth.users (id),
  ADD COLUMN IF NOT EXISTS driver_offer_queue uuid[],
  ADD COLUMN IF NOT EXISTS driver_offer_index int NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS current_offer_driver_id uuid REFERENCES auth.users (id),
  ADD COLUMN IF NOT EXISTS current_offer_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

COMMENT ON COLUMN public.shipments.origin_city IS 'Cidade da origem (filtro de solicitações no app motorista).';
COMMENT ON COLUMN public.shipments.driver_offer_queue IS 'Ordem de motoristas (mesma rota); primeiro = preferido do cliente.';
COMMENT ON COLUMN public.shipments.driver_offer_index IS '-1 não iniciado; 0..n-1 oferta atual; >=n esgotado.';
COMMENT ON COLUMN public.shipments.current_offer_driver_id IS 'Motorista com janela de aceite ativa.';
COMMENT ON COLUMN public.shipments.current_offer_expires_at IS 'Fim da janela (3 min) para o current_offer_driver_id.';
COMMENT ON COLUMN public.shipments.cancellation_reason IS 'ex.: no_driver_accepted';

CREATE INDEX IF NOT EXISTS idx_shipments_current_offer_driver
  ON public.shipments (current_offer_driver_id)
  WHERE current_offer_driver_id IS NOT NULL AND driver_id IS NULL;

-- ---------------------------------------------------------------------------
-- Preparador: só encomendas com base e motorista já atribuído (aceite).
-- ---------------------------------------------------------------------------
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
    AND s.base_id IS NOT NULL
    AND s.status IN ('pending_review', 'confirmed', 'in_progress')
  ORDER BY s.created_at DESC
  LIMIT 50;
$$;

COMMENT ON FUNCTION public.preparer_shipment_queue() IS
  'Fila do preparador: mesma base, motorista já aceitou o envio, status operacional.';

-- ---------------------------------------------------------------------------
-- RLS motorista: ver oferta dirigida + fluxos anteriores (viagem / base).
-- ---------------------------------------------------------------------------
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
      driver_id IS NULL
      AND status = 'confirmed'
      AND base_id IS NOT NULL
      AND public.worker_is_shipments_preparer_for_base(shipments.base_id)
    )
    OR (
      shipments.base_id IS NULL
      AND shipments.scheduled_trip_id IS NOT NULL
      AND shipments.driver_id IS NULL
      AND shipments.status IN ('pending_review', 'confirmed')
      AND EXISTS (
        SELECT 1
        FROM public.scheduled_trips st
        WHERE st.id = shipments.scheduled_trip_id
          AND st.driver_id = auth.uid()
      )
    )
    OR (
      shipments.driver_id IS NULL
      AND shipments.status = 'confirmed'
      AND shipments.current_offer_driver_id = auth.uid()
      AND shipments.current_offer_expires_at IS NOT NULL
      AND shipments.current_offer_expires_at > now()
    )
  );

CREATE POLICY "drivers_can_update_shipments"
  ON public.shipments
  FOR UPDATE
  USING (
    status = 'pending_review'
    OR driver_id = auth.uid()
    OR (
      status = 'confirmed'
      AND driver_id IS NULL
      AND base_id IS NOT NULL
      AND public.worker_is_shipments_preparer_for_base(shipments.base_id)
    )
    OR (
      shipments.base_id IS NULL
      AND shipments.scheduled_trip_id IS NOT NULL
      AND shipments.driver_id IS NULL
      AND shipments.status IN ('pending_review', 'confirmed')
      AND EXISTS (
        SELECT 1
        FROM public.scheduled_trips st
        WHERE st.id = shipments.scheduled_trip_id
          AND st.driver_id = auth.uid()
      )
    )
    OR (
      shipments.driver_id IS NULL
      AND shipments.status = 'confirmed'
      AND shipments.current_offer_driver_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Igualdade de rota (coords).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shipment_same_route_as_trip(
  s_origin_lat double precision,
  s_origin_lng double precision,
  s_dest_lat double precision,
  s_dest_lng double precision,
  t_origin_lat double precision,
  t_origin_lng double precision,
  t_dest_lat double precision,
  t_dest_lng double precision
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    abs(s_origin_lat - t_origin_lat) < 0.00001
    AND abs(s_origin_lng - t_origin_lng) < 0.00001
    AND abs(s_dest_lat - t_dest_lat) < 0.00001
    AND abs(s_dest_lng - t_dest_lng) < 0.00001;
$$;

REVOKE ALL ON FUNCTION public.shipment_same_route_as_trip(
  double precision, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shipment_same_route_as_trip(
  double precision, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision
) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Inicia fila após pagamento (cliente = dono do envio).
-- ---------------------------------------------------------------------------
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
      updated_at = now(),
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
    current_offer_expires_at = now() + interval '3 minutes',
    updated_at = now()
  WHERE id = p_shipment_id;

  RETURN jsonb_build_object('ok', true, 'queue_length', coalesce(array_length(q, 1), 0));
END;
$$;

REVOKE ALL ON FUNCTION public.shipment_begin_driver_offering(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shipment_begin_driver_offering(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shipment_begin_driver_offering(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Expira ofertas e avança fila (ou cancela).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shipment_process_expired_driver_offers()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  q uuid[];
  idx int;
  n int;
  processed int := 0;
BEGIN
  FOR rec IN
    SELECT id, driver_offer_queue, driver_offer_index, current_offer_expires_at
    FROM public.shipments
    WHERE driver_id IS NULL
      AND status = 'confirmed'
      AND driver_offer_index >= 0
      AND current_offer_expires_at IS NOT NULL
      AND current_offer_expires_at <= now()
    LIMIT 30
    FOR UPDATE SKIP LOCKED
  LOOP
    q := coalesce(rec.driver_offer_queue, '{}');
    idx := rec.driver_offer_index;
    n := coalesce(array_length(q, 1), 0);
    processed := processed + 1;

    IF idx + 1 < n THEN
      UPDATE public.shipments
      SET
        driver_offer_index = idx + 1,
        current_offer_driver_id = q[idx + 2],
        current_offer_expires_at = now() + interval '3 minutes',
        updated_at = now()
      WHERE id = rec.id;
    ELSE
      UPDATE public.shipments
      SET
        status = 'cancelled',
        cancellation_reason = 'no_driver_accepted',
        current_offer_driver_id = NULL,
        current_offer_expires_at = NULL,
        driver_offer_index = -1,
        updated_at = now()
      WHERE id = rec.id;
    END IF;
  END LOOP;

  RETURN processed;
END;
$$;

REVOKE ALL ON FUNCTION public.shipment_process_expired_driver_offers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shipment_process_expired_driver_offers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.shipment_process_expired_driver_offers() TO service_role;

-- ---------------------------------------------------------------------------
-- Motorista recusa antes do timeout (avança imediatamente).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shipment_driver_pass_offer(p_shipment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.shipments%ROWTYPE;
  q uuid[];
  idx int;
  n int;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF s.current_offer_driver_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_your_offer');
  END IF;
  IF s.driver_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_assigned');
  END IF;

  q := coalesce(s.driver_offer_queue, '{}');
  idx := s.driver_offer_index;
  n := coalesce(array_length(q, 1), 0);

  IF idx + 1 < n THEN
    UPDATE public.shipments
    SET
      driver_offer_index = idx + 1,
      current_offer_driver_id = q[idx + 2],
      current_offer_expires_at = now() + interval '3 minutes',
      updated_at = now()
    WHERE id = p_shipment_id;
    RETURN jsonb_build_object('ok', true, 'advanced', true);
  END IF;

  UPDATE public.shipments
  SET
    status = 'cancelled',
    cancellation_reason = 'no_driver_accepted',
    current_offer_driver_id = NULL,
    current_offer_expires_at = NULL,
    driver_offer_index = -1,
    updated_at = now()
  WHERE id = p_shipment_id;
  RETURN jsonb_build_object('ok', true, 'cancelled', true);
END;
$$;

REVOKE ALL ON FUNCTION public.shipment_driver_pass_offer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shipment_driver_pass_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shipment_driver_pass_offer(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Motorista aceita oferta.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shipment_driver_accept_offer(p_shipment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.shipments%ROWTYPE;
  trip_id uuid;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF s.current_offer_driver_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_your_offer');
  END IF;
  IF s.driver_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_assigned');
  END IF;
  IF s.current_offer_expires_at IS NOT NULL AND s.current_offer_expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'offer_expired');
  END IF;

  SELECT st.id INTO trip_id
  FROM public.scheduled_trips st
  WHERE st.driver_id = auth.uid()
    AND st.status = 'active'
    AND st.is_active IS TRUE
    AND st.driver_journey_started_at IS NULL
    AND st.departure_at > now()
    AND public.shipment_same_route_as_trip(
      s.origin_lat, s.origin_lng, s.destination_lat, s.destination_lng,
      st.origin_lat, st.origin_lng, st.destination_lat, st.destination_lng
    )
  ORDER BY st.departure_at ASC
  LIMIT 1;

  IF trip_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_matching_trip');
  END IF;

  UPDATE public.shipments
  SET
    driver_id = auth.uid(),
    driver_accepted_at = now(),
    scheduled_trip_id = trip_id,
    current_offer_driver_id = NULL,
    current_offer_expires_at = NULL,
    driver_offer_index = -1,
    driver_offer_queue = NULL,
    updated_at = now()
  WHERE id = p_shipment_id;

  RETURN jsonb_build_object('ok', true, 'scheduled_trip_id', trip_id);
END;
$$;

REVOKE ALL ON FUNCTION public.shipment_driver_accept_offer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shipment_driver_accept_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shipment_driver_accept_offer(uuid) TO service_role;
