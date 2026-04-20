-- =============================================================================
-- Materialização idempotente de paradas de passageiro/encomenda em trip_stops
-- -----------------------------------------------------------------------------
-- A RPC remota `generate_trip_stops` é destrutiva (DELETE inicial) e incompleta:
--   * cria só `passenger_pickup` e `shipment_pickup` (sem dropoff).
--   * não materializa paradas de dependente.
--   * apaga histórico (status `completed`) e paradas já inseridas por
--     `ensure_dependent_trip_stops`.
--
-- Este arquivo reimplementa o padrão já usado para dependentes — `ensure_*` +
-- `resolve_*` — para passageiros e encomendas, mantendo `trip_stops.code`
-- preenchido (pickup/delivery code da entidade). Também expõe uma RPC-agregadora
-- `ensure_all_trip_stops` para o app consumir sem se preocupar com ordem.
-- =============================================================================

-- Helper: próxima posição disponível em trip_stops (respeita max existente).
CREATE OR REPLACE FUNCTION public.trip_stops_next_sequence (p_trip_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(max(sequence_order), 0) + 1
  FROM public.trip_stops
  WHERE scheduled_trip_id = p_trip_id;
$$;

-- -----------------------------------------------------------------------------
-- ensure_shipment_trip_stops
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_shipment_trip_stops (p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.shipments%ROWTYPE;
  b RECORD;
  v_pickup_address text;
  v_pickup_lat double precision;
  v_pickup_lng double precision;
  v_seq integer;
BEGIN
  IF p_trip_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT public.auth_is_driver_of_scheduled_trip (p_trip_id) THEN
    RETURN;
  END IF;

  FOR s IN
    SELECT *
    FROM public.shipments sh
    WHERE sh.scheduled_trip_id = p_trip_id
      AND sh.status NOT IN ('cancelled', 'delivered', 'disputed', 'refunded')
  LOOP
    -- Endereço/ponto da coleta: origem do cliente ou base, se `base_id` definido.
    v_pickup_address := coalesce(nullif(trim(s.origin_address), ''), '');
    v_pickup_lat := s.origin_lat;
    v_pickup_lng := s.origin_lng;

    IF s.base_id IS NOT NULL THEN
      SELECT
        coalesce(nullif(trim(array_to_string(array_remove(ARRAY[bs.name, bs.address, bs.city], NULL), ' — ')), ''), bs.address, ''),
        bs.lat,
        bs.lng
      INTO v_pickup_address, v_pickup_lat, v_pickup_lng
      FROM public.bases bs
      WHERE bs.id = s.base_id
        AND bs.is_active = true;
    END IF;

    -- shipment_pickup
    IF NOT EXISTS (
      SELECT 1
      FROM public.trip_stops ts
      WHERE ts.scheduled_trip_id = p_trip_id
        AND ts.entity_id = s.id
        AND lower(trim(ts.stop_type)) IN ('shipment_pickup', 'package_pickup')
    ) THEN
      v_seq := public.trip_stops_next_sequence (p_trip_id);
      INSERT INTO public.trip_stops (
        scheduled_trip_id, stop_type, entity_id, label, address,
        lat, lng, sequence_order, status, notes, code
      ) VALUES (
        p_trip_id, 'shipment_pickup', s.id,
        CASE
          WHEN s.base_id IS NOT NULL THEN 'Retirada na base'
          ELSE 'Encomenda: ' || coalesce(nullif(trim(s.recipient_name), ''), 'Pacote')
        END,
        coalesce(v_pickup_address, ''),
        v_pickup_lat, v_pickup_lng,
        v_seq, 'pending',
        nullif(trim(s.instructions), ''), nullif(trim(s.pickup_code), '')
      );
    ELSE
      -- Completa `code` se ficou vazio na linha existente (generate_trip_stops não preenche).
      UPDATE public.trip_stops ts
      SET code = nullif(trim(s.pickup_code), ''), updated_at = now()
      WHERE ts.scheduled_trip_id = p_trip_id
        AND ts.entity_id = s.id
        AND lower(trim(ts.stop_type)) IN ('shipment_pickup', 'package_pickup')
        AND (ts.code IS NULL OR trim(ts.code) = '')
        AND nullif(trim(s.pickup_code), '') IS NOT NULL;
    END IF;

    -- shipment_dropoff
    IF NOT EXISTS (
      SELECT 1
      FROM public.trip_stops ts
      WHERE ts.scheduled_trip_id = p_trip_id
        AND ts.entity_id = s.id
        AND lower(trim(ts.stop_type)) IN ('shipment_dropoff', 'package_dropoff')
    ) THEN
      v_seq := public.trip_stops_next_sequence (p_trip_id);
      INSERT INTO public.trip_stops (
        scheduled_trip_id, stop_type, entity_id, label, address,
        lat, lng, sequence_order, status, notes, code
      ) VALUES (
        p_trip_id, 'shipment_dropoff', s.id,
        coalesce(nullif(trim(s.recipient_name), ''), 'Destinatário'),
        coalesce(nullif(trim(s.destination_address), ''), ''),
        s.destination_lat, s.destination_lng,
        v_seq, 'pending',
        NULL, nullif(trim(s.delivery_code), '')
      );
    ELSE
      UPDATE public.trip_stops ts
      SET code = nullif(trim(s.delivery_code), ''), updated_at = now()
      WHERE ts.scheduled_trip_id = p_trip_id
        AND ts.entity_id = s.id
        AND lower(trim(ts.stop_type)) IN ('shipment_dropoff', 'package_dropoff')
        AND (ts.code IS NULL OR trim(ts.code) = '')
        AND nullif(trim(s.delivery_code), '') IS NOT NULL;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_shipment_trip_stops (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_shipment_trip_stops (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_shipment_trip_stops (uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- ensure_passenger_trip_stops
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_passenger_trip_stops (p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.bookings%ROWTYPE;
  v_label text;
  v_seq integer;
BEGIN
  IF p_trip_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT public.auth_is_driver_of_scheduled_trip (p_trip_id) THEN
    RETURN;
  END IF;

  FOR b IN
    SELECT *
    FROM public.bookings bk
    WHERE bk.scheduled_trip_id = p_trip_id
      AND bk.status NOT IN ('cancelled', 'completed', 'refunded')
  LOOP
    SELECT coalesce(nullif(trim(p.full_name), ''), 'Passageiro')
      INTO v_label
    FROM public.profiles p
    WHERE p.id = b.user_id;
    v_label := coalesce(v_label, 'Passageiro');

    -- passenger_pickup
    IF NOT EXISTS (
      SELECT 1
      FROM public.trip_stops ts
      WHERE ts.scheduled_trip_id = p_trip_id
        AND ts.entity_id = b.id
        AND lower(trim(ts.stop_type)) = 'passenger_pickup'
    ) THEN
      v_seq := public.trip_stops_next_sequence (p_trip_id);
      INSERT INTO public.trip_stops (
        scheduled_trip_id, stop_type, entity_id, label, address,
        lat, lng, sequence_order, status, notes, code
      ) VALUES (
        p_trip_id, 'passenger_pickup', b.id,
        v_label,
        coalesce(nullif(trim(b.origin_address), ''), ''),
        b.origin_lat, b.origin_lng,
        v_seq, 'pending',
        NULL, nullif(trim(b.pickup_code), '')
      );
    ELSE
      UPDATE public.trip_stops ts
      SET code = nullif(trim(b.pickup_code), ''), updated_at = now()
      WHERE ts.scheduled_trip_id = p_trip_id
        AND ts.entity_id = b.id
        AND lower(trim(ts.stop_type)) = 'passenger_pickup'
        AND (ts.code IS NULL OR trim(ts.code) = '')
        AND nullif(trim(b.pickup_code), '') IS NOT NULL;
    END IF;

    -- passenger_dropoff
    IF NOT EXISTS (
      SELECT 1
      FROM public.trip_stops ts
      WHERE ts.scheduled_trip_id = p_trip_id
        AND ts.entity_id = b.id
        AND lower(trim(ts.stop_type)) = 'passenger_dropoff'
    ) THEN
      v_seq := public.trip_stops_next_sequence (p_trip_id);
      INSERT INTO public.trip_stops (
        scheduled_trip_id, stop_type, entity_id, label, address,
        lat, lng, sequence_order, status, notes, code
      ) VALUES (
        p_trip_id, 'passenger_dropoff', b.id,
        v_label,
        coalesce(nullif(trim(b.destination_address), ''), ''),
        b.destination_lat, b.destination_lng,
        v_seq, 'pending',
        NULL, nullif(trim(b.delivery_code), '')
      );
    ELSE
      UPDATE public.trip_stops ts
      SET code = nullif(trim(b.delivery_code), ''), updated_at = now()
      WHERE ts.scheduled_trip_id = p_trip_id
        AND ts.entity_id = b.id
        AND lower(trim(ts.stop_type)) = 'passenger_dropoff'
        AND (ts.code IS NULL OR trim(ts.code) = '')
        AND nullif(trim(b.delivery_code), '') IS NOT NULL;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_passenger_trip_stops (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_passenger_trip_stops (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_passenger_trip_stops (uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- ensure_all_trip_stops — agregador (evita 3 round-trips do app)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_all_trip_stops (p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_trip_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT public.auth_is_driver_of_scheduled_trip (p_trip_id) THEN
    RETURN;
  END IF;
  PERFORM public.ensure_passenger_trip_stops (p_trip_id);
  PERFORM public.ensure_shipment_trip_stops (p_trip_id);
  PERFORM public.ensure_dependent_trip_stops (p_trip_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_all_trip_stops (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_all_trip_stops (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_all_trip_stops (uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- resolve_shipment_trip_stop_row — id sintético (shipment-pickup/dropoff-<uuid>)
-- → id real em trip_stops (materializa se faltar).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_shipment_trip_stop_row (
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

  IF p_client_stop_id !~* '^shipment-(pickup|dropoff)-' THEN
    RETURN NULL;
  END IF;

  v_kind := (regexp_match(lower(p_client_stop_id), '^shipment-(pickup|dropoff)-'))[1];

  m := regexp_match(
    p_client_stop_id,
    '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
  );
  IF m IS NOT NULL AND m[1] IS NOT NULL THEN
    BEGIN
      v_shipment_id := m[1]::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_shipment_id := NULL;
    END;
  END IF;
  IF v_shipment_id IS NULL THEN
    v_shipment_id := p_fallback_entity_id;
  END IF;
  IF v_shipment_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public.ensure_shipment_trip_stops (p_scheduled_trip_id);

  SELECT ts.id INTO v_row
  FROM public.trip_stops ts
  WHERE ts.scheduled_trip_id = p_scheduled_trip_id
    AND ts.entity_id = v_shipment_id
    AND (
      (
        v_kind = 'pickup'
        AND lower(trim(ts.stop_type)) IN ('shipment_pickup', 'package_pickup')
      )
      OR (
        v_kind = 'dropoff'
        AND lower(trim(ts.stop_type)) IN ('shipment_dropoff', 'package_dropoff')
      )
    )
  ORDER BY
    CASE WHEN lower(trim(ts.status)) = 'pending' THEN 0 ELSE 1 END,
    ts.sequence_order NULLS LAST
  LIMIT 1;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_shipment_trip_stop_row (uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_shipment_trip_stop_row (uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_shipment_trip_stop_row (uuid, text, uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- resolve_passenger_trip_stop_row — id sintético (booking-pickup/dropoff-<uuid>)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_passenger_trip_stop_row (
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
  v_booking_id uuid;
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

  IF p_client_stop_id !~* '^booking-(pickup|dropoff)-' THEN
    RETURN NULL;
  END IF;

  v_kind := (regexp_match(lower(p_client_stop_id), '^booking-(pickup|dropoff)-'))[1];

  m := regexp_match(
    p_client_stop_id,
    '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
  );
  IF m IS NOT NULL AND m[1] IS NOT NULL THEN
    BEGIN
      v_booking_id := m[1]::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_booking_id := NULL;
    END;
  END IF;
  IF v_booking_id IS NULL THEN
    v_booking_id := p_fallback_entity_id;
  END IF;
  IF v_booking_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public.ensure_passenger_trip_stops (p_scheduled_trip_id);

  SELECT ts.id INTO v_row
  FROM public.trip_stops ts
  WHERE ts.scheduled_trip_id = p_scheduled_trip_id
    AND ts.entity_id = v_booking_id
    AND (
      (v_kind = 'pickup' AND lower(trim(ts.stop_type)) = 'passenger_pickup')
      OR (v_kind = 'dropoff' AND lower(trim(ts.stop_type)) = 'passenger_dropoff')
    )
  ORDER BY
    CASE WHEN lower(trim(ts.status)) = 'pending' THEN 0 ELSE 1 END,
    ts.sequence_order NULLS LAST
  LIMIT 1;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_passenger_trip_stop_row (uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_passenger_trip_stop_row (uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_passenger_trip_stop_row (uuid, text, uuid) TO service_role;

COMMENT ON FUNCTION public.ensure_shipment_trip_stops (uuid) IS
  'Materializa shipment_pickup/dropoff em trip_stops (idempotente), preenchendo code com shipments.pickup_code / delivery_code.';
COMMENT ON FUNCTION public.ensure_passenger_trip_stops (uuid) IS
  'Materializa passenger_pickup/dropoff em trip_stops (idempotente), preenchendo code com bookings.pickup_code / delivery_code.';
COMMENT ON FUNCTION public.ensure_all_trip_stops (uuid) IS
  'Garante todas as paradas (passageiro + encomenda + dependente) em trip_stops; idempotente.';
COMMENT ON FUNCTION public.resolve_shipment_trip_stop_row (uuid, text, uuid) IS
  'Motorista: retorna id real em trip_stops para shipment_pickup/shipment_dropoff a partir do id sintético do app.';
COMMENT ON FUNCTION public.resolve_passenger_trip_stop_row (uuid, text, uuid) IS
  'Motorista: retorna id real em trip_stops para passenger_pickup/passenger_dropoff a partir do id sintético do app.';
