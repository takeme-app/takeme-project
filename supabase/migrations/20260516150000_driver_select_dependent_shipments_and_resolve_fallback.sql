-- Motorista autenticado pode ler envios de dependente ligados à viagem que está a conduzir
-- (necessário para casar `trip_stops.entity_id` com `dependent_id` vs id do envio no app).

DROP POLICY IF EXISTS "Motorista lê dependent_shipments da viagem atribuída" ON public.dependent_shipments;

CREATE POLICY "Motorista lê dependent_shipments da viagem atribuída"
  ON public.dependent_shipments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.scheduled_trips st
      WHERE st.id = public.dependent_shipments.scheduled_trip_id
        AND st.driver_id = auth.uid()
    )
  );

COMMENT ON POLICY "Motorista lê dependent_shipments da viagem atribuída" ON public.dependent_shipments IS
  'Permite ao motorista obter dependent_id / id do envio para sincronizar paradas com trip_stops.';

-- Fallback: linha em trip_stops com entity_id = id do envio (sem depender do EXISTS em dependent_shipments).
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
    AND (
      ts.entity_id = v_shipment_id
      OR EXISTS (
        SELECT 1
        FROM public.dependent_shipments ds
        WHERE ds.id = v_shipment_id
          AND ds.scheduled_trip_id = p_scheduled_trip_id
          AND (ts.entity_id = ds.id OR (ds.dependent_id IS NOT NULL AND ts.entity_id = ds.dependent_id))
      )
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
