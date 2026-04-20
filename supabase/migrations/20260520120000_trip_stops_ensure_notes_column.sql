-- Bancos onde `trip_stops` já existia antes de 20260428103000 não receberam a coluna `notes`
-- pelo `CREATE TABLE IF NOT EXISTS`. A RPC `ensure_dependent_trip_stops` insere em `notes`
-- (usando `dependent_shipments.instructions`), e sem a coluna falha com:
--   `column "notes" of relation "trip_stops" does not exist`.
-- Efeito colateral: nenhuma parada `dependent_pickup/dropoff` é criada e o app motorista
-- devolve "Não foi possível sincronizar as paradas com o servidor".

ALTER TABLE public.trip_stops
  ADD COLUMN IF NOT EXISTS notes text;

-- Recria a função para recompilar o corpo SQL após a coluna existir (garante que o
-- plano cacheado da função antiga seja invalidado).
CREATE OR REPLACE FUNCTION public.ensure_dependent_trip_stops (p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.dependent_shipments%ROWTYPE;
  anchor_seq integer;
  max_seq integer;
BEGIN
  IF p_trip_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT public.auth_is_driver_of_scheduled_trip (p_trip_id) THEN
    RETURN;
  END IF;

  FOR d IN
    SELECT *
    FROM public.dependent_shipments ds
    WHERE ds.scheduled_trip_id = p_trip_id
      AND ds.status IN ('pending_review', 'confirmed', 'in_progress')
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.trip_stops ts
      WHERE ts.scheduled_trip_id = p_trip_id
        AND ts.entity_id = d.id
        AND lower(trim(ts.stop_type)) = 'dependent_pickup'
    ) THEN
      CONTINUE;
    END IF;

    SELECT min(ts.sequence_order)
      INTO anchor_seq
    FROM public.trip_stops ts
    WHERE ts.scheduled_trip_id = p_trip_id
      AND lower(trim(ts.stop_type)) IN (
        'package_dropoff',
        'shipment_dropoff',
        'passenger_dropoff',
        'trip_destination',
        'base_dropoff'
      );

    IF anchor_seq IS NOT NULL THEN
      UPDATE public.trip_stops ts
      SET sequence_order = ts.sequence_order + 2,
          updated_at = now()
      WHERE ts.scheduled_trip_id = p_trip_id
        AND ts.sequence_order >= anchor_seq;

      INSERT INTO public.trip_stops (
        scheduled_trip_id, stop_type, entity_id, label, address,
        lat, lng, sequence_order, status, notes, code
      ) VALUES (
        p_trip_id, 'dependent_pickup', d.id,
        trim(coalesce(d.full_name, 'Dependente')),
        coalesce(nullif(trim(d.origin_address), ''), ''),
        d.origin_lat, d.origin_lng, anchor_seq, 'pending',
        nullif(trim(d.instructions), ''), nullif(trim(d.pickup_code), '')
      );

      INSERT INTO public.trip_stops (
        scheduled_trip_id, stop_type, entity_id, label, address,
        lat, lng, sequence_order, status, notes, code
      ) VALUES (
        p_trip_id, 'dependent_dropoff', d.id,
        trim(coalesce(d.full_name, 'Dependente')),
        coalesce(nullif(trim(d.destination_address), ''), ''),
        d.destination_lat, d.destination_lng, anchor_seq + 1, 'pending',
        NULL, nullif(trim(d.delivery_code), '')
      );
    ELSE
      SELECT coalesce(max(ts.sequence_order), 0)
        INTO max_seq
      FROM public.trip_stops ts
      WHERE ts.scheduled_trip_id = p_trip_id;

      INSERT INTO public.trip_stops (
        scheduled_trip_id, stop_type, entity_id, label, address,
        lat, lng, sequence_order, status, notes, code
      ) VALUES (
        p_trip_id, 'dependent_pickup', d.id,
        trim(coalesce(d.full_name, 'Dependente')),
        coalesce(nullif(trim(d.origin_address), ''), ''),
        d.origin_lat, d.origin_lng, max_seq + 1, 'pending',
        nullif(trim(d.instructions), ''), nullif(trim(d.pickup_code), '')
      );

      INSERT INTO public.trip_stops (
        scheduled_trip_id, stop_type, entity_id, label, address,
        lat, lng, sequence_order, status, notes, code
      ) VALUES (
        p_trip_id, 'dependent_dropoff', d.id,
        trim(coalesce(d.full_name, 'Dependente')),
        coalesce(nullif(trim(d.destination_address), ''), ''),
        d.destination_lat, d.destination_lng, max_seq + 2, 'pending',
        NULL, nullif(trim(d.delivery_code), '')
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_dependent_trip_stops (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_dependent_trip_stops (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_dependent_trip_stops (uuid) TO service_role;

COMMENT ON FUNCTION public.ensure_dependent_trip_stops (uuid) IS
  'Garante paradas dependent_pickup/dropoff em trip_stops. Copia pickup_code / delivery_code de dependent_shipments para trip_stops.code e preserva d.instructions em notes.';
