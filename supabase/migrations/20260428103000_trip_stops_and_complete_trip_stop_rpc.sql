-- Paradas de viagem (fonte de verdade) + RPC para conclusão pelo motorista.
-- Se `trip_stops` já existir no projeto remoto, CREATE TABLE IF NOT EXISTS não altera a estrutura existente.

CREATE TABLE IF NOT EXISTS public.trip_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_trip_id uuid NOT NULL REFERENCES public.scheduled_trips (id) ON DELETE CASCADE,
  stop_type text NOT NULL,
  entity_id uuid,
  label text,
  address text NOT NULL DEFAULT '',
  lat double precision,
  lng double precision,
  sequence_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_stops_status_check CHECK (status IN ('pending', 'completed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_trip_stops_scheduled_trip_id ON public.trip_stops (scheduled_trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_stops_trip_sequence ON public.trip_stops (scheduled_trip_id, sequence_order);

COMMENT ON TABLE public.trip_stops IS 'Paradas ordenadas da viagem; geradas por generate_trip_stops no banco remoto.';

-- RLS: motorista da viagem lê; atualização direta opcional (RPC usa SECURITY DEFINER).
ALTER TABLE public.trip_stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_stops_select_driver" ON public.trip_stops;
CREATE POLICY "trip_stops_select_driver"
  ON public.trip_stops
  FOR SELECT
  TO authenticated
  USING (public.auth_is_driver_of_scheduled_trip (scheduled_trip_id));

DROP POLICY IF EXISTS "trip_stops_update_driver" ON public.trip_stops;
CREATE POLICY "trip_stops_update_driver"
  ON public.trip_stops
  FOR UPDATE
  TO authenticated
  USING (public.auth_is_driver_of_scheduled_trip (scheduled_trip_id))
  WITH CHECK (public.auth_is_driver_of_scheduled_trip (scheduled_trip_id));

-- -----------------------------------------------------------------------------
-- Conclui parada: valida motorista, código (encomenda), atualiza trip_stops e shipments.
-- -----------------------------------------------------------------------------
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

  -- Encomenda: validação de 4 dígitos (código na parada ou na shipment)
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

    -- Se houver código cadastrado, deve coincidir; se não houver código no banco, aceita qualquer 4 dígitos (comportamento legado do app).
    IF length(exp_digits) > 0 AND digits_in IS DISTINCT FROM exp_digits THEN
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
  END IF;

  UPDATE public.trip_stops
  SET
    status = 'completed',
    updated_at = now()
  WHERE id = p_trip_stop_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_trip_stop (uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_trip_stop (uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_trip_stop (uuid, text) TO service_role;

COMMENT ON FUNCTION public.complete_trip_stop (uuid, text) IS
  'Motorista autenticado conclui parada (trip_stops + efeitos em shipments).';
