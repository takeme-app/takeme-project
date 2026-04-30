-- Recusa unificada no app motorista: oferta ativa, fila «preferiu você» antes da oferta,
-- ou card duplicado «na minha viagem» (RLS não permitia UPDATE para cancelled).

CREATE OR REPLACE FUNCTION public.shipment_driver_recuse(p_shipment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.shipments%ROWTYPE;
  q uuid[] := '{}';
  r record;
  n int;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF s.driver_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_assigned');
  END IF;

  -- Janela de oferta ativa para este motorista: reutiliza a lógica existente.
  IF s.current_offer_driver_id IS NOT DISTINCT FROM auth.uid() THEN
    RETURN (SELECT public.shipment_driver_pass_offer(p_shipment_id));
  END IF;

  -- Preferido pelo cliente, mas a oferta ainda não foi aberta (current_offer nulo).
  IF s.client_preferred_driver_id IS NOT DISTINCT FROM auth.uid()
     AND s.current_offer_driver_id IS NULL THEN
    FOR r IN
      SELECT st.driver_id
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
      IF r.driver_id IS DISTINCT FROM auth.uid()
         AND NOT (r.driver_id = ANY (q)) THEN
        q := array_append(q, r.driver_id);
      END IF;
    END LOOP;

    n := coalesce(array_length(q, 1), 0);
    IF n = 0 THEN
      UPDATE public.shipments
      SET
        status = 'cancelled',
        cancellation_reason = 'no_driver_accepted',
        client_preferred_driver_id = NULL,
        current_offer_driver_id = NULL,
        current_offer_expires_at = NULL,
        driver_offer_queue = '{}',
        driver_offer_index = -1
      WHERE id = p_shipment_id;
      RETURN jsonb_build_object('ok', true, 'cancelled', true, 'reason', 'queue_empty_after_preferred_recuse');
    END IF;

    UPDATE public.shipments
    SET
      client_preferred_driver_id = NULL,
      driver_offer_queue = q,
      driver_offer_index = 0,
      current_offer_driver_id = q[1],
      current_offer_expires_at = now() + interval '30 minutes'
    WHERE id = p_shipment_id;
    RETURN jsonb_build_object('ok', true, 'advanced', true, 'reason', 'preferred_recused_before_offer');
  END IF;

  -- Motorista da viagem vê o envio na rota (sem ser oferta/preferido): cancela com definer (RLS não cobria WITH CHECK para cancelled).
  IF s.base_id IS NULL
     AND s.scheduled_trip_id IS NOT NULL
     AND public.auth_is_driver_of_scheduled_trip(s.scheduled_trip_id) THEN
    UPDATE public.shipments
    SET
      status = 'cancelled',
      cancellation_reason = 'driver_recused_trip_visibility',
      current_offer_driver_id = NULL,
      current_offer_expires_at = NULL,
      driver_offer_queue = NULL,
      driver_offer_index = -1
    WHERE id = p_shipment_id
      AND driver_id IS NULL;
    RETURN jsonb_build_object('ok', true, 'cancelled', true, 'reason', 'trip_driver_recused');
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
END;
$$;

COMMENT ON FUNCTION public.shipment_driver_recuse(uuid) IS
  'Motorista recusa envio: oferta ativa (pass_offer), preferido antes da oferta (reconstrói fila), ou cancela visão na viagem (duplicate card / RLS).';

REVOKE ALL ON FUNCTION public.shipment_driver_recuse(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shipment_driver_recuse(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shipment_driver_recuse(uuid) TO service_role;
