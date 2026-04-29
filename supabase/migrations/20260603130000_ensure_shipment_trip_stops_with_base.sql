-- =============================================================================
-- Cenário 3 (PDF "Sequência de Solicitação de Código"): para encomendas COM base,
-- o motorista retira o pacote NA BASE (etapas 10-12) e o PIN dessa retirada
-- é `base_to_driver_code` (PIN C), não `pickup_code`.
--
-- Esta migration substitui `ensure_shipment_trip_stops` para preencher
-- `trip_stops.code` corretamente:
--   * encomenda COM base → shipment_pickup.code = base_to_driver_code
--   * encomenda SEM base → shipment_pickup.code = pickup_code (atual)
--   * shipment_dropoff   → delivery_code (em ambos os casos = PIN D do PDF)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ensure_shipment_trip_stops (p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.shipments%ROWTYPE;
  v_pickup_address text;
  v_pickup_lat double precision;
  v_pickup_lng double precision;
  v_pickup_code_for_driver text;
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
    v_pickup_address := coalesce(nullif(trim(s.origin_address), ''), '');
    v_pickup_lat := s.origin_lat;
    v_pickup_lng := s.origin_lng;

    -- Encomenda com base: o motorista retira na BASE, não no cliente.
    -- Ponto de retirada = base. PIN da retirada = base_to_driver_code (PIN C).
    IF s.base_id IS NOT NULL THEN
      SELECT
        coalesce(nullif(trim(array_to_string(array_remove(ARRAY[bs.name, bs.address, bs.city], NULL), ' — ')), ''), bs.address, ''),
        bs.lat,
        bs.lng
      INTO v_pickup_address, v_pickup_lat, v_pickup_lng
      FROM public.bases bs
      WHERE bs.id = s.base_id
        AND bs.is_active = true;

      v_pickup_code_for_driver := nullif(trim(s.base_to_driver_code), '');
    ELSE
      v_pickup_code_for_driver := nullif(trim(s.pickup_code), '');
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
        nullif(trim(s.instructions), ''), v_pickup_code_for_driver
      );
    ELSE
      -- Backfill: corrige `code` para o PIN correto conforme presença de base.
      UPDATE public.trip_stops ts
      SET code = v_pickup_code_for_driver, updated_at = now()
      WHERE ts.scheduled_trip_id = p_trip_id
        AND ts.entity_id = s.id
        AND lower(trim(ts.stop_type)) IN ('shipment_pickup', 'package_pickup')
        AND v_pickup_code_for_driver IS NOT NULL
        AND (
          ts.code IS NULL
          OR trim(ts.code) = ''
          OR (s.base_id IS NOT NULL AND nullif(trim(ts.code), '') IS DISTINCT FROM v_pickup_code_for_driver)
        );
    END IF;

    -- shipment_dropoff (PIN D = delivery_code, sem mudança)
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

COMMENT ON FUNCTION public.ensure_shipment_trip_stops (uuid) IS
  'Materializa shipment_pickup/dropoff em trip_stops. PIN da retirada: base_to_driver_code se a encomenda tem base, senão pickup_code. PIN da entrega: delivery_code (cenário 3 do PDF).';
