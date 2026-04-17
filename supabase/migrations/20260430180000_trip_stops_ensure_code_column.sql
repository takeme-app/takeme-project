-- Bancos onde `trip_stops` já existia antes de 20260428103000 não receberam a coluna `code`
-- pelo CREATE TABLE IF NOT EXISTS. A RPC `complete_trip_stop` usa `v_stop.code`; sem a coluna
-- o Postgres acusa: record "v_stop" has no field "code".

ALTER TABLE public.trip_stops
  ADD COLUMN IF NOT EXISTS code text;

-- Recria a função para recompilar `trip_stops%ROWTYPE` com o atributo `code`.
CREATE OR REPLACE FUNCTION public.complete_trip_stop (
  p_trip_stop_id uuid,
  p_confirmation_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid ();
  v_stop public.trip_stops%ROWTYPE;
  v_trip_id uuid;
  tnorm text;
  digits_in text;
  exp_digits text;
  sh_pick text;
  sh_del text;
  b_pick text;
  b_del text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_stop FROM public.trip_stops WHERE id = p_trip_stop_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stop_not_found');
  END IF;

  v_trip_id := v_stop.scheduled_trip_id;

  IF NOT public.auth_is_driver_of_scheduled_trip (v_trip_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF lower(trim(v_stop.status)) = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'already_completed', true);
  END IF;

  tnorm := lower(trim(v_stop.stop_type));

  IF tnorm IN (
    'package_pickup',
    'shipment_pickup',
    'package_dropoff',
    'shipment_dropoff'
  ) THEN
    IF v_stop.entity_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'missing_entity');
    END IF;

    digits_in := regexp_replace(coalesce(p_confirmation_code, ''), '\D', '', 'g');

    IF length(digits_in) <> 4 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'code_length');
    END IF;

    SELECT s.pickup_code, s.delivery_code
      INTO sh_pick, sh_del
    FROM public.shipments s
    WHERE s.id = v_stop.entity_id;

    IF tnorm IN ('package_pickup', 'shipment_pickup') THEN
      exp_digits := regexp_replace(
        coalesce(nullif(trim(v_stop.code), ''), coalesce(sh_pick, '')),
        '\D',
        '',
        'g'
      );
    ELSE
      exp_digits := regexp_replace(
        coalesce(nullif(trim(v_stop.code), ''), coalesce(sh_del, '')),
        '\D',
        '',
        'g'
      );
    END IF;

    IF length(exp_digits) <> 4 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'missing_code');
    END IF;

    IF digits_in IS DISTINCT FROM exp_digits THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
    END IF;

    IF tnorm IN ('package_pickup', 'shipment_pickup') THEN
      UPDATE public.shipments
      SET
        picked_up_at = coalesce(picked_up_at, now()),
        status = CASE
          WHEN status = 'confirmed' THEN 'in_progress'::text
          ELSE status
        END
      WHERE id = v_stop.entity_id
        AND EXISTS (
          SELECT 1 FROM public.scheduled_trips st
          WHERE st.id = v_trip_id AND st.driver_id = v_uid
        );
    ELSE
      UPDATE public.shipments
      SET
        delivered_at = coalesce(delivered_at, now()),
        status = 'delivered'
      WHERE id = v_stop.entity_id
        AND EXISTS (
          SELECT 1 FROM public.scheduled_trips st
          WHERE st.id = v_trip_id AND st.driver_id = v_uid
        );
    END IF;

  ELSIF tnorm IN ('passenger_pickup', 'passenger_dropoff') THEN
    IF v_stop.entity_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'missing_entity');
    END IF;

    digits_in := regexp_replace(coalesce(p_confirmation_code, ''), '\D', '', 'g');

    IF length(digits_in) <> 4 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'code_length');
    END IF;

    SELECT b.pickup_code, b.delivery_code
      INTO b_pick, b_del
    FROM public.bookings b
    WHERE b.id = v_stop.entity_id
      AND b.scheduled_trip_id = v_trip_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'missing_entity');
    END IF;

    IF tnorm = 'passenger_pickup' THEN
      exp_digits := regexp_replace(coalesce(nullif(trim(v_stop.code), ''), coalesce(b_pick, '')), '\D', '', 'g');
    ELSE
      exp_digits := regexp_replace(coalesce(nullif(trim(v_stop.code), ''), coalesce(b_del, '')), '\D', '', 'g');
    END IF;

    IF length(exp_digits) <> 4 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'missing_code');
    END IF;

    IF digits_in IS DISTINCT FROM exp_digits THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
    END IF;
  END IF;

  UPDATE public.trip_stops
  SET
    status = 'completed',
    updated_at = now()
  WHERE id = p_trip_stop_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.complete_trip_stop (uuid, text) IS
  'Motorista conclui parada: encomenda (shipment + código) ou passageiro (booking.pickup_code / delivery_code).';
