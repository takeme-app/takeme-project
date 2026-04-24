-- Suporte no app motorista para "ligar para o contacto" e "Cancelar embarque"
-- a partir do sheet de detalhes da parada em ActiveTripScreen.
--
-- 1) driver_get_trip_stop_contact(p_trip_stop_id): devolve { name, phone } do
--    contacto associado à parada (passageiro via bookings→profiles, dependente
--    via dependent_shipments.contact_phone, encomenda via shipments.recipient_phone).
--    SECURITY DEFINER para contornar a RLS de profiles, mas só responde ao
--    motorista da viagem.
--
-- 2) driver_cancel_pickup(p_trip_stop_id): marca a parada de coleta (e o seu
--    dropoff correspondente, quando existe) como 'skipped', permitindo avançar
--    a rota quando o passageiro/dependente não comparece ou a coleta é
--    cancelada no local. Não altera a bookings/shipments (cobrança de no-show
--    do passageiro é tratada por outro fluxo).

CREATE OR REPLACE FUNCTION public.driver_get_trip_stop_contact (
  p_trip_stop_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid ();
  v_stop public.trip_stops%ROWTYPE;
  v_name text;
  v_phone text;
  tnorm text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_stop FROM public.trip_stops WHERE id = p_trip_stop_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stop_not_found');
  END IF;

  IF NOT public.auth_is_driver_of_scheduled_trip (v_stop.scheduled_trip_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  tnorm := lower(trim(v_stop.stop_type));

  IF tnorm IN ('passenger_pickup', 'passenger_dropoff') THEN
    SELECT p.full_name, p.phone
      INTO v_name, v_phone
    FROM public.bookings b
      LEFT JOIN public.profiles p ON p.id = b.user_id
    WHERE b.id = v_stop.entity_id;
  ELSIF tnorm IN ('dependent_pickup', 'dependent_dropoff') THEN
    SELECT ds.full_name, ds.contact_phone
      INTO v_name, v_phone
    FROM public.dependent_shipments ds
    WHERE ds.id = v_stop.entity_id;
  ELSIF tnorm IN (
    'package_pickup',
    'shipment_pickup',
    'package_dropoff',
    'shipment_dropoff'
  ) THEN
    SELECT s.recipient_name, s.recipient_phone
      INTO v_name, v_phone
    FROM public.shipments s
    WHERE s.id = v_stop.entity_id;
  ELSE
    RETURN jsonb_build_object('ok', true, 'name', NULL, 'phone', NULL);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'name', v_name,
    'phone', v_phone
  );
END;
$$;

REVOKE ALL ON FUNCTION public.driver_get_trip_stop_contact (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_get_trip_stop_contact (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_get_trip_stop_contact (uuid) TO service_role;

COMMENT ON FUNCTION public.driver_get_trip_stop_contact (uuid) IS
  'Motorista autenticado obtém nome/telefone do contacto associado à parada.';

-- ----------------------------------------------------------------------------
-- Cancela coleta (no-show / desistência no local).
-- Marca a parada de pickup como skipped; se houver uma parada de dropoff
-- para a mesma entidade (passageiro/dependente/encomenda), também é marcada
-- skipped para que a rota avance sem tentar desembarcar quem nunca embarcou.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.driver_cancel_pickup (
  p_trip_stop_id uuid
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
  v_dropoff_type text;
  v_skipped_dropoff uuid;
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

  tnorm := lower(trim(v_stop.stop_type));

  IF tnorm NOT IN (
    'passenger_pickup',
    'dependent_pickup',
    'package_pickup',
    'shipment_pickup'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_pickup');
  END IF;

  IF lower(trim(v_stop.status)) IN ('completed', 'skipped') THEN
    RETURN jsonb_build_object('ok', true, 'already_final', true);
  END IF;

  UPDATE public.trip_stops
  SET status = 'skipped', updated_at = now()
  WHERE id = p_trip_stop_id;

  v_dropoff_type := CASE tnorm
    WHEN 'passenger_pickup' THEN 'passenger_dropoff'
    WHEN 'dependent_pickup' THEN 'dependent_dropoff'
    WHEN 'package_pickup' THEN 'package_dropoff'
    WHEN 'shipment_pickup' THEN 'shipment_dropoff'
  END;

  IF v_stop.entity_id IS NOT NULL AND v_dropoff_type IS NOT NULL THEN
    UPDATE public.trip_stops
    SET status = 'skipped', updated_at = now()
    WHERE scheduled_trip_id = v_trip_id
      AND lower(trim(stop_type)) = v_dropoff_type
      AND entity_id = v_stop.entity_id
      AND lower(trim(status)) NOT IN ('completed', 'skipped')
    RETURNING id INTO v_skipped_dropoff;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'pickup_stop_id', p_trip_stop_id,
    'dropoff_stop_id', v_skipped_dropoff
  );
END;
$$;

REVOKE ALL ON FUNCTION public.driver_cancel_pickup (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_cancel_pickup (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_cancel_pickup (uuid) TO service_role;

COMMENT ON FUNCTION public.driver_cancel_pickup (uuid) IS
  'Motorista autenticado cancela/pula a coleta atual (pickup + dropoff correspondente).';
