-- Janela de aceite na fila sequencial de motoristas: 3 min → 30 min.

COMMENT ON COLUMN public.shipments.current_offer_expires_at IS
  'Fim da janela (30 min) para o current_offer_driver_id aceitar ou recusar.';

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
        current_offer_expires_at = now() + interval '30 minutes'
      WHERE id = rec.id;
    ELSE
      UPDATE public.shipments
      SET
        status = 'cancelled',
        cancellation_reason = 'no_driver_accepted',
        current_offer_driver_id = NULL,
        current_offer_expires_at = NULL,
        driver_offer_index = -1
      WHERE id = rec.id;
    END IF;
  END LOOP;

  RETURN processed;
END;
$$;

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
      current_offer_expires_at = now() + interval '30 minutes'
    WHERE id = p_shipment_id;
    RETURN jsonb_build_object('ok', true, 'advanced', true);
  END IF;

  UPDATE public.shipments
  SET
    status = 'cancelled',
    cancellation_reason = 'no_driver_accepted',
    current_offer_driver_id = NULL,
    current_offer_expires_at = NULL,
    driver_offer_index = -1
  WHERE id = p_shipment_id;
  RETURN jsonb_build_object('ok', true, 'cancelled', true);
END;
$$;

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
    driver_offer_queue = NULL
  WHERE id = p_shipment_id;

  RETURN jsonb_build_object('ok', true, 'scheduled_trip_id', trip_id);
END;
$$;
