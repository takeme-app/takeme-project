-- =============================================================================
-- Cenário 3 (com base): Admin (painel web) como operador da base — valida PIN B
-- e PIN C digitando o código informado verbalmente pelo preparador / motorista.
--
-- * complete_shipment_preparer_to_base_by_admin — PIN B
-- * complete_shipment_base_to_driver_by_admin — PIN C + conclui parada de
--   retirada na base em trip_stops (para o app motorista progredir).
--
-- Requisito de papel: public.is_admin() (JWT ou worker_profiles.role=admin).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- complete_shipment_preparer_to_base_by_admin (PIN B)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_shipment_preparer_to_base_by_admin (
  p_shipment_id uuid,
  p_confirmation_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_base_id uuid;
  v_picked_up_preparer timestamptz;
  v_expected text;
  v_already timestamptz;
  v_digits_in text;
  v_exp_digits text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_shipment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_entity');
  END IF;

  SELECT s.base_id, s.picked_up_by_preparer_at,
         s.preparer_to_base_code, s.delivered_to_base_at
    INTO v_base_id, v_picked_up_preparer, v_expected, v_already
  FROM public.shipments s
  WHERE s.id = p_shipment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_entity');
  END IF;

  IF v_base_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_base');
  END IF;

  IF v_picked_up_preparer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pickup_not_completed');
  END IF;

  IF v_already IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_completed', true);
  END IF;

  v_digits_in := regexp_replace(coalesce(p_confirmation_code, ''), '\D', '', 'g');
  IF length(v_digits_in) <> 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_length');
  END IF;

  v_exp_digits := regexp_replace(coalesce(v_expected, ''), '\D', '', 'g');
  IF length(v_exp_digits) <> 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_code');
  END IF;

  IF v_digits_in IS DISTINCT FROM v_exp_digits THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  UPDATE public.shipments
  SET
    delivered_to_base_at = now(),
    updated_at = now()
  WHERE id = p_shipment_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_shipment_preparer_to_base_by_admin (uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_shipment_preparer_to_base_by_admin (uuid, text) TO authenticated;

COMMENT ON FUNCTION public.complete_shipment_preparer_to_base_by_admin (uuid, text) IS
  'PIN B (cenário 3): operador admin digita o código informado pelo preparador na entrega na base. Atualiza delivered_to_base_at.';

-- -----------------------------------------------------------------------------
-- complete_shipment_base_to_driver_by_admin (PIN C)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_shipment_base_to_driver_by_admin (
  p_shipment_id uuid,
  p_confirmation_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_base_id uuid;
  v_delivered_base timestamptz;
  v_already_driver timestamptz;
  v_expected text;
  v_digits_in text;
  v_exp_digits text;
  v_trip_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_shipment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_entity');
  END IF;

  SELECT s.base_id, s.delivered_to_base_at, s.picked_up_by_driver_from_base_at,
         s.base_to_driver_code, s.scheduled_trip_id
    INTO v_base_id, v_delivered_base, v_already_driver, v_expected, v_trip_id
  FROM public.shipments s
  WHERE s.id = p_shipment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_entity');
  END IF;

  IF v_base_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_base');
  END IF;

  IF v_delivered_base IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_at_base');
  END IF;

  IF v_already_driver IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_completed', true);
  END IF;

  v_digits_in := regexp_replace(coalesce(p_confirmation_code, ''), '\D', '', 'g');
  IF length(v_digits_in) <> 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_length');
  END IF;

  v_exp_digits := regexp_replace(coalesce(v_expected, ''), '\D', '', 'g');
  IF length(v_exp_digits) <> 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_code');
  END IF;

  IF v_digits_in IS DISTINCT FROM v_exp_digits THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  UPDATE public.shipments
  SET
    picked_up_at = coalesce(picked_up_at, now()),
    picked_up_by_driver_from_base_at = coalesce(picked_up_by_driver_from_base_at, now()),
    status = CASE
      WHEN status = 'confirmed' THEN 'in_progress'::text
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_shipment_id;

  IF v_trip_id IS NOT NULL THEN
    UPDATE public.trip_stops ts
    SET
      status = 'completed',
      updated_at = now()
    WHERE ts.scheduled_trip_id = v_trip_id
      AND ts.entity_id = p_shipment_id
      AND lower(trim(ts.stop_type)) IN ('package_pickup', 'shipment_pickup')
      AND lower(trim(ts.status)) = 'pending';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_shipment_base_to_driver_by_admin (uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_shipment_base_to_driver_by_admin (uuid, text) TO authenticated;

COMMENT ON FUNCTION public.complete_shipment_base_to_driver_by_admin (uuid, text) IS
  'PIN C (cenário 3): operador admin digita o código informado pelo motorista. Atualiza picked_up_by_driver_from_base_at e conclui parada de retirada na base em trip_stops quando há scheduled_trip_id.';
