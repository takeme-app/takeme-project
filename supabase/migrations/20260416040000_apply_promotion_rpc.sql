-- RPC para aplicar promoção ativa no checkout.
-- Retorna: promotion_id, promo_discount_cents, adjusted_admin_pct, gain_pct_to_worker.
-- Se não há promoção aplicável, retorna NULLs.

CREATE OR REPLACE FUNCTION public.apply_active_promotion(
  p_order_type text,       -- 'bookings', 'shipments', 'dependent_shipments', 'excursions'
  p_user_id uuid,          -- ID do cliente/passageiro
  p_amount_cents int        -- Valor bruto do pedido em centavos
)
RETURNS TABLE (
  promotion_id uuid,
  promo_discount_cents int,
  adjusted_admin_pct numeric(5,2),
  gain_pct numeric(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_promo record;
  v_discount int := 0;
  v_base_admin_pct numeric(5,2);
  v_adjusted_pct numeric(5,2);
BEGIN
  -- Buscar admin_pct padrão
  SELECT (value->>'percentage')::numeric(5,2) INTO v_base_admin_pct
  FROM public.platform_settings WHERE key = 'default_admin_pct';
  IF v_base_admin_pct IS NULL THEN v_base_admin_pct := 15; END IF;

  -- Buscar promoção ativa mais relevante (prioriza maior desconto)
  SELECT p.* INTO v_promo
  FROM public.promotions p
  WHERE p.is_active = true
    AND now() >= p.start_at
    AND now() <= p.end_at
    AND p_order_type = ANY(p.applies_to)
  ORDER BY p.discount_value DESC
  LIMIT 1;

  IF v_promo IS NULL THEN
    -- Sem promoção: retornar valores padrão
    RETURN QUERY SELECT NULL::uuid, 0, v_base_admin_pct, 0::numeric(5,2);
    RETURN;
  END IF;

  -- Calcular desconto
  IF v_promo.discount_type = 'percentage' THEN
    v_discount := ROUND(p_amount_cents * v_promo.discount_value / 100.0)::int;
  ELSE
    v_discount := LEAST(v_promo.discount_value, p_amount_cents);
  END IF;

  -- Ajustar admin_pct: admin perde gain_pct_to_worker
  v_adjusted_pct := GREATEST(0, v_base_admin_pct - COALESCE(v_promo.gain_pct_to_worker, 0));

  RETURN QUERY SELECT
    v_promo.id,
    v_discount,
    v_adjusted_pct,
    COALESCE(v_promo.gain_pct_to_worker, 0::numeric(5,2));
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_active_promotion(text, uuid, int) TO authenticated;
