-- Resolve `trip_stops.id` real para paradas de dependente (id sintético no app ou `entity_id` legado).
-- Alguns deploys gravam `trip_stops.entity_id` como `dependent_shipments.dependent_id` em vez do id do envio.

CREATE OR REPLACE FUNCTION public.resolve_dependent_trip_stop_row (
  p_scheduled_trip_id uuid,
  p_client_stop_id text,
  p_fallback_entity_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shipment_id uuid;
  v_kind text;
  v_row uuid;
  m text[];
BEGIN
  IF v_uid IS NULL OR p_scheduled_trip_id IS NULL OR p_client_stop_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT public.auth_is_driver_of_scheduled_trip (p_scheduled_trip_id) THEN
    RETURN NULL;
  END IF;

  IF p_client_stop_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT ts.id INTO v_row
    FROM public.trip_stops ts
    WHERE ts.id = p_client_stop_id::uuid
      AND ts.scheduled_trip_id = p_scheduled_trip_id;
    IF FOUND THEN
      RETURN v_row;
    END IF;
  END IF;

  IF p_client_stop_id !~* '^dependent-(pickup|dropoff)-' THEN
    RETURN NULL;
  END IF;

  v_kind := (regexp_match(lower(p_client_stop_id), '^dependent-(pickup|dropoff)-'))[1];

  m := regexp_match(
    p_client_stop_id,
    '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
  );
  IF m IS NOT NULL AND m[1] IS NOT NULL THEN
    BEGIN
      v_shipment_id := m[1]::uuid;
    EXCEPTION
      WHEN OTHERS THEN
        v_shipment_id := NULL;
    END;
  END IF;

  IF v_shipment_id IS NULL THEN
    v_shipment_id := p_fallback_entity_id;
  END IF;

  IF v_shipment_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public.ensure_dependent_trip_stops (p_scheduled_trip_id);

  SELECT ts.id INTO v_row
  FROM public.trip_stops ts
  WHERE ts.scheduled_trip_id = p_scheduled_trip_id
    AND EXISTS (
      SELECT 1
      FROM public.dependent_shipments ds
      WHERE ds.id = v_shipment_id
        AND ds.scheduled_trip_id = p_scheduled_trip_id
        AND (ts.entity_id = ds.id OR (ds.dependent_id IS NOT NULL AND ts.entity_id = ds.dependent_id))
    )
    AND (
      (
        v_kind = 'pickup'
        AND (
          lower(trim(ts.stop_type)) = 'dependent_pickup'
          OR (
            lower(ts.stop_type) LIKE '%dependent%'
            AND (
              lower(ts.stop_type) LIKE '%pickup%'
              OR lower(ts.stop_type) LIKE '%collect%'
            )
          )
        )
      )
      OR (
        v_kind = 'dropoff'
        AND (
          lower(trim(ts.stop_type)) = 'dependent_dropoff'
          OR (
            lower(ts.stop_type) LIKE '%dependent%'
            AND (
              lower(ts.stop_type) LIKE '%dropoff%'
              OR lower(ts.stop_type) LIKE '%drop_off%'
              OR lower(ts.stop_type) LIKE '%deliver%'
            )
          )
        )
      )
    )
  ORDER BY
    CASE WHEN lower(trim(ts.status)) = 'pending' THEN 0 ELSE 1 END,
    ts.sequence_order NULLS LAST
  LIMIT 1;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_dependent_trip_stop_row (uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_dependent_trip_stop_row (uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_dependent_trip_stop_row (uuid, text, uuid) TO service_role;

COMMENT ON FUNCTION public.resolve_dependent_trip_stop_row (uuid, text, uuid) IS
  'Motorista: retorna o id real em trip_stops para embarque/desembarque de dependente (id sintético ou entity_id legado).';

-- complete_trip_stop: aceitar `trip_stops.entity_id` = dependent_id (cadastro) ou id do envio.
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
  dep_pick text;
  dep_del text;
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

  ELSIF tnorm IN ('dependent_pickup', 'dependent_dropoff') THEN
    IF v_stop.entity_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'missing_entity');
    END IF;

    digits_in := regexp_replace(coalesce(p_confirmation_code, ''), '\D', '', 'g');

    IF length(digits_in) <> 4 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'code_length');
    END IF;

    SELECT d.pickup_code, d.delivery_code
      INTO dep_pick, dep_del
    FROM public.dependent_shipments d
    WHERE d.scheduled_trip_id = v_trip_id
      AND (d.id = v_stop.entity_id OR (d.dependent_id IS NOT NULL AND d.dependent_id = v_stop.entity_id))
    ORDER BY CASE WHEN d.id = v_stop.entity_id THEN 0 ELSE 1 END
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'missing_entity');
    END IF;

    IF tnorm = 'dependent_pickup' THEN
      exp_digits := regexp_replace(
        coalesce(nullif(trim(v_stop.code), ''), coalesce(dep_pick, '')),
        '\D',
        '',
        'g'
      );
    ELSE
      exp_digits := regexp_replace(
        coalesce(nullif(trim(v_stop.code), ''), coalesce(dep_del, '')),
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
  'Motorista conclui parada: encomenda (código), passageiro (booking), dependente (dependent_shipments por id do envio ou dependent_id) ou outras sem PIN.';
