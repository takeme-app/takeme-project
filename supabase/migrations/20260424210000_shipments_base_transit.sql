-- Fase 2 — Jornada pós-aceite quando o envio passa pela base.
--
-- Contexto (confira a Fase 1):
--   Motorista aceita SEMPRE primeiro. Se o envio tem `base_id`:
--     1. Preparador retira o pacote na casa do cliente  (usa `picked_up_at` — já existe).
--     2. Preparador entrega o pacote na base            (adiciona `base_delivered_at`).
--     3. Motorista retira o pacote na base              (adiciona `driver_picked_from_base_at`).
--     4. Motorista entrega ao destinatário              (usa `delivered_at` — já existe).
--
-- Esta migration:
--   • Adiciona `base_delivered_at` e `driver_picked_from_base_at` em `shipments`.
--   • Cria RPC `shipment_preparer_confirm_delivered_to_base(p_shipment_id uuid)`.
--   • Cria RPC `shipment_driver_confirm_picked_from_base(p_shipment_id uuid)`.
--   • Insere notificações em cada transição (motorista, cliente).
--
-- Obs.: o `status` do envio permanece `in_progress` entre "preparador entregou na base"
-- e "motorista retirou na base" — o pacote continua ativo na cadeia; o progresso fica
-- refletido nos novos timestamps, não em um novo valor de status.

-- ===========================================================================
-- 1) Colunas novas em `public.shipments`
-- ===========================================================================
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS base_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS driver_picked_from_base_at timestamptz;

COMMENT ON COLUMN public.shipments.base_delivered_at IS
  'Instante em que o preparador da base entregou o pacote na base (via RPC shipment_preparer_confirm_delivered_to_base).';

COMMENT ON COLUMN public.shipments.driver_picked_from_base_at IS
  'Instante em que o motorista retirou o pacote na base (via RPC shipment_driver_confirm_picked_from_base).';

-- ===========================================================================
-- 2) RPC preparador: confirma entrega na base
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.shipment_preparer_confirm_delivered_to_base(
  p_shipment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.shipments%ROWTYPE;
  base_name text;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'shipment_not_found');
  END IF;
  IF s.base_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'shipment_has_no_base');
  END IF;
  IF NOT public.worker_is_shipments_preparer_for_base(s.base_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF s.driver_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'driver_not_assigned');
  END IF;
  IF s.picked_up_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pickup_not_confirmed');
  END IF;
  IF s.base_delivered_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  UPDATE public.shipments
  SET base_delivered_at = now()
  WHERE id = p_shipment_id;

  SELECT name INTO base_name FROM public.bases WHERE id = s.base_id;

  -- Motorista: pacote pronto pra retirar na base
  INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
  VALUES (
    s.driver_id,
    'Pacote pronto na base',
    'O preparador deixou o pacote na ' || coalesce(base_name, 'base') || '. Retire antes da viagem.',
    'shipments_deliveries',
    'motorista',
    jsonb_build_object('shipment_id', s.id, 'base_id', s.base_id)
  );

  -- Cliente: atualização do status
  INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
  VALUES (
    s.user_id,
    'Pacote na base',
    'Seu pacote está na ' || coalesce(base_name, 'base') || '. O motorista coletará antes da viagem.',
    'shipments',
    'cliente',
    jsonb_build_object('shipment_id', s.id, 'base_id', s.base_id)
  );

  RETURN jsonb_build_object('ok', true, 'base_delivered_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.shipment_preparer_confirm_delivered_to_base(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shipment_preparer_confirm_delivered_to_base(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shipment_preparer_confirm_delivered_to_base(uuid) TO service_role;

COMMENT ON FUNCTION public.shipment_preparer_confirm_delivered_to_base(uuid) IS
  'Preparador confirma que entregou o pacote na base. Exige pacote já coletado (picked_up_at) e aceita por um motorista (driver_id). Notifica motorista + cliente.';

-- ===========================================================================
-- 3) RPC motorista: confirma retirada na base
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.shipment_driver_confirm_picked_from_base(
  p_shipment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.shipments%ROWTYPE;
  base_name text;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'shipment_not_found');
  END IF;
  IF s.driver_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF s.base_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'shipment_has_no_base');
  END IF;
  IF s.base_delivered_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'base_not_delivered_yet');
  END IF;
  IF s.driver_picked_from_base_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  UPDATE public.shipments
  SET driver_picked_from_base_at = now()
  WHERE id = p_shipment_id;

  SELECT name INTO base_name FROM public.bases WHERE id = s.base_id;

  -- Cliente: motorista em rota
  INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
  VALUES (
    s.user_id,
    'Motorista a caminho',
    'O motorista retirou seu pacote na ' || coalesce(base_name, 'base') || ' e segue para o destinatário.',
    'shipments',
    'cliente',
    jsonb_build_object('shipment_id', s.id, 'base_id', s.base_id)
  );

  RETURN jsonb_build_object('ok', true, 'driver_picked_from_base_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.shipment_driver_confirm_picked_from_base(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shipment_driver_confirm_picked_from_base(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shipment_driver_confirm_picked_from_base(uuid) TO service_role;

COMMENT ON FUNCTION public.shipment_driver_confirm_picked_from_base(uuid) IS
  'Motorista confirma que retirou o pacote na base. Exige base_delivered_at já gravado pelo preparador. Notifica cliente.';
