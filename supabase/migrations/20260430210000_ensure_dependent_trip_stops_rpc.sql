-- RPC usada pelo app motorista (`useTripStops`, confirmação de parada sintética) para materializar
-- paradas `dependent_*` em `trip_stops` quando `generate_trip_stops` não as inclui.

CREATE OR REPLACE FUNCTION public.ensure_dependent_trip_stops (p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  next_seq integer;
BEGIN
  IF p_trip_id IS NULL THEN
    RETURN;
  END IF;

  SELECT coalesce(max(sequence_order), 0) INTO next_seq
  FROM public.trip_stops
  WHERE scheduled_trip_id = p_trip_id;

  FOR r IN
    SELECT
      ds.id,
      ds.full_name,
      ds.origin_address,
      ds.origin_lat,
      ds.origin_lng,
      ds.destination_address,
      ds.destination_lat,
      ds.destination_lng,
      ds.instructions,
      ds.pickup_code,
      ds.delivery_code,
      ds.status
    FROM public.dependent_shipments ds
    WHERE ds.scheduled_trip_id = p_trip_id
      AND ds.status IN ('pending_review', 'confirmed', 'in_progress')
    ORDER BY ds.created_at ASC
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.trip_stops t
      WHERE t.scheduled_trip_id = p_trip_id
        AND t.entity_id = r.id
        AND lower(trim(t.stop_type)) = 'dependent_pickup'
    ) THEN
      next_seq := next_seq + 1;
      INSERT INTO public.trip_stops (
        scheduled_trip_id,
        stop_type,
        entity_id,
        label,
        address,
        lat,
        lng,
        sequence_order,
        status,
        notes,
        code
      )
      VALUES (
        p_trip_id,
        'dependent_pickup',
        r.id,
        coalesce(nullif(trim(r.full_name), ''), 'Dependente'),
        coalesce(nullif(trim(r.origin_address), ''), ''),
        r.origin_lat,
        r.origin_lng,
        next_seq,
        'pending',
        nullif(trim(r.instructions), ''),
        nullif(trim(r.pickup_code), '')
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.trip_stops t
      WHERE t.scheduled_trip_id = p_trip_id
        AND t.entity_id = r.id
        AND lower(trim(t.stop_type)) = 'dependent_dropoff'
    ) THEN
      next_seq := next_seq + 1;
      INSERT INTO public.trip_stops (
        scheduled_trip_id,
        stop_type,
        entity_id,
        label,
        address,
        lat,
        lng,
        sequence_order,
        status,
        notes,
        code
      )
      VALUES (
        p_trip_id,
        'dependent_dropoff',
        r.id,
        coalesce(nullif(trim(r.full_name), ''), 'Dependente'),
        coalesce(nullif(trim(r.destination_address), ''), ''),
        r.destination_lat,
        r.destination_lng,
        next_seq,
        'pending',
        null,
        nullif(trim(r.delivery_code), '')
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_dependent_trip_stops (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_dependent_trip_stops (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_dependent_trip_stops (uuid) TO service_role;

COMMENT ON FUNCTION public.ensure_dependent_trip_stops (uuid) IS
  'Insere em trip_stops as paradas dependent_pickup / dependent_dropoff faltantes para dependent_shipments da viagem.';
