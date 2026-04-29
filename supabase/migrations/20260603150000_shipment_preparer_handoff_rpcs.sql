-- =============================================================================
-- Cenário 3 (PDF "Sequência de Solicitação de Código"): RPCs para os handoffs
-- do PREPARADOR, antes da viagem do motorista começar.
--
-- Etapas 1-3 (PIN A — Passageiro → Preparador): preparador chega ao cliente,
--   informa PIN A; passageiro digita no app cliente para validar.
--   → RPC: complete_shipment_passenger_to_preparer  (chamada pelo CLIENTE)
--
-- Etapas 6-8 (PIN B — Preparador → Base): preparador chega à base; o operador
--   da base informa PIN B; preparador digita no app dele para validar.
--   → RPC: complete_shipment_preparer_to_base  (chamada pelo PREPARADOR)
--
-- Como a Base ainda não tem UI, o preparador é a "interface interina" que
-- também opera o handoff Base → Motorista (PIN C). Isso é resolvido pelo
-- motorista digitando PIN C no app dele e a `complete_trip_stop` validando
-- (vide migration 20260603140000).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- complete_shipment_passenger_to_preparer (PIN A)
--
-- Chamador: passageiro (auth.uid() = shipments.user_id).
-- Entrada: id do shipment + PIN A informado pelo preparador.
-- Saída: jsonb com {ok, error?}.
-- Side-effects: atualiza picked_up_by_preparer_at (idempotente).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_shipment_passenger_to_preparer (
  p_shipment_id uuid,
  p_confirmation_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_id uuid;
  v_expected text;
  v_already timestamptz;
  v_digits_in text;
  v_exp_digits text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_shipment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_entity');
  END IF;

  SELECT s.user_id, s.passenger_to_preparer_code, s.picked_up_by_preparer_at
    INTO v_user_id, v_expected, v_already
  FROM public.shipments s
  WHERE s.id = p_shipment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_entity');
  END IF;

  IF v_user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
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
    picked_up_by_preparer_at = now(),
    updated_at = now()
  WHERE id = p_shipment_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_shipment_passenger_to_preparer (uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_shipment_passenger_to_preparer (uuid, text) TO authenticated;

COMMENT ON FUNCTION public.complete_shipment_passenger_to_preparer (uuid, text) IS
  'PIN A do PDF cenário 3 (etapas 1-3): passageiro digita o código informado pelo preparador na coleta. Atualiza picked_up_by_preparer_at.';

-- -----------------------------------------------------------------------------
-- complete_shipment_preparer_to_base (PIN B)
--
-- Chamador: preparador (auth.uid() = shipments.preparer_id).
-- Entrada: id do shipment + PIN B informado pela base.
-- Saída: jsonb com {ok, error?}.
-- Side-effects: atualiza delivered_to_base_at (idempotente) e status do
--   shipment para 'in_base' (se a transição é válida).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_shipment_preparer_to_base (
  p_shipment_id uuid,
  p_confirmation_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_preparer_id uuid;
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

  IF p_shipment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_entity');
  END IF;

  SELECT s.preparer_id, s.base_id, s.picked_up_by_preparer_at,
         s.preparer_to_base_code, s.delivered_to_base_at
    INTO v_preparer_id, v_base_id, v_picked_up_preparer, v_expected, v_already
  FROM public.shipments s
  WHERE s.id = p_shipment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_entity');
  END IF;

  IF v_preparer_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
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

REVOKE ALL ON FUNCTION public.complete_shipment_preparer_to_base (uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_shipment_preparer_to_base (uuid, text) TO authenticated;

COMMENT ON FUNCTION public.complete_shipment_preparer_to_base (uuid, text) IS
  'PIN B do PDF cenário 3 (etapas 6-8): preparador digita o código informado pela base na entrega. Atualiza delivered_to_base_at.';
