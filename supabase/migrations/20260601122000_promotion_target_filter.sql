-- ============================================================================
-- Promotion target_audiences filter
-- ============================================================================
-- O cadastro de promoção no admin já grava `target_audiences` (ex.: ['passengers'],
-- ['drivers'], ['preparers_shipments', 'preparers_excursions']), mas as RPCs
-- `apply_active_promotion*` ignoravam essa coluna — o que permitia que uma
-- promoção marcada só para "motoristas" aplicasse desconto ao passageiro, ou
-- que uma promo só para passageiros repassasse gain ao motorista.
--
-- Esta migration reescreve ambas as funções para exigir match entre o público
-- cadastrado na promo e o "papel" envolvido na RPC:
--   - discount_pct_to_passenger só é considerado quando 'passengers' está em target_audiences
--   - gain_pct_to_worker só é considerado quando algum papel de worker está em
--     target_audiences (drivers para viagens; preparers_* para encomendas/excursões)
-- ============================================================================

DROP FUNCTION IF EXISTS public.apply_active_promotion(text, uuid, int, uuid, uuid);

CREATE OR REPLACE FUNCTION public.apply_active_promotion(
  p_order_type text,
  p_user_id uuid,
  p_amount_cents int,
  p_worker_route_id uuid DEFAULT NULL,
  p_pricing_route_id uuid DEFAULT NULL
)
RETURNS TABLE (
  promotion_id uuid,
  promo_discount_cents int,
  adjusted_admin_pct numeric(5, 2),
  gain_pct numeric(5, 2),
  discount_pct numeric(5, 2),
  promo_worker_route_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_promo record;
  v_base_admin_pct numeric(5, 2);
  v_discount_pct numeric(5, 2);
  v_gain_pct numeric(5, 2);
  v_discount_cents int := 0;
  v_worker_roles text[];
BEGIN
  SELECT (value->>'percentage')::numeric(5, 2) INTO v_base_admin_pct
  FROM public.platform_settings
  WHERE key = 'default_admin_pct';

  IF v_base_admin_pct IS NULL THEN
    v_base_admin_pct := 15;
  END IF;

  -- Papéis de worker relevantes para este order_type
  IF p_order_type = 'bookings' THEN
    v_worker_roles := ARRAY['drivers'];
  ELSIF p_order_type IN ('shipments', 'dependent_shipments') THEN
    v_worker_roles := ARRAY['drivers', 'preparers_shipments'];
  ELSIF p_order_type = 'excursions' THEN
    v_worker_roles := ARRAY['preparers_excursions'];
  ELSE
    v_worker_roles := ARRAY[]::text[];
  END IF;

  SELECT p.* INTO v_promo
  FROM public.promotions p
  WHERE p.is_active = true
    AND now() >= p.start_at
    AND now() <= p.end_at
    AND p_order_type = ANY(p.applies_to)
    AND (
      (p_worker_route_id IS NOT NULL AND p.worker_route_id = p_worker_route_id)
      OR (p_pricing_route_id IS NOT NULL AND p.pricing_route_id = p_pricing_route_id)
      OR (p.worker_route_id IS NULL AND p.pricing_route_id IS NULL)
    )
  ORDER BY
    (CASE WHEN p.worker_route_id = p_worker_route_id THEN 0
          WHEN p.pricing_route_id = p_pricing_route_id THEN 1
          ELSE 2 END),
    GREATEST(COALESCE(p.discount_pct_to_passenger, 0), p.discount_value::numeric) DESC
  LIMIT 1;

  IF v_promo IS NULL THEN
    RETURN QUERY SELECT
      NULL::uuid,
      0,
      v_base_admin_pct,
      0::numeric(5, 2),
      0::numeric(5, 2),
      NULL::uuid;
    RETURN;
  END IF;

  -- Só aplica desconto ao passageiro se a promo for direcionada a passageiros.
  IF 'passengers' = ANY(v_promo.target_audiences) THEN
    v_discount_pct := COALESCE(v_promo.discount_pct_to_passenger, 0);
    IF v_discount_pct = 0 AND v_promo.discount_type = 'percentage' THEN
      v_discount_pct := LEAST(v_promo.discount_value::numeric, 100);
    END IF;
  ELSE
    v_discount_pct := 0;
  END IF;

  -- Só aplica gain ao worker se o papel correspondente está nos target_audiences.
  IF v_promo.target_audiences && v_worker_roles THEN
    v_gain_pct := COALESCE(v_promo.gain_pct_to_worker, 0);
  ELSE
    v_gain_pct := 0;
  END IF;

  IF v_promo.discount_type = 'percentage' THEN
    v_discount_cents := ROUND(p_amount_cents * v_discount_pct / 100.0)::int;
  ELSE
    v_discount_cents := LEAST(v_promo.discount_value, p_amount_cents);
  END IF;

  RETURN QUERY SELECT
    v_promo.id,
    v_discount_cents,
    GREATEST(0, v_base_admin_pct - v_gain_pct)::numeric(5, 2),
    v_gain_pct,
    v_discount_pct,
    v_promo.worker_route_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_active_promotion(text, uuid, int, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_active_promotion(text, uuid, int, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_active_promotion(text, uuid, int, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.apply_active_promotion(text, uuid, int, uuid, uuid) IS
  'Aplica promoção ativa priorizando rota. Respeita target_audiences: discount só para passengers; gain só quando papel de worker está no público-alvo.';

-- ----------------------------------------------------------------------------
-- Versão batch
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.apply_active_promotion_for_amounts(text, uuid, integer[], uuid, uuid);

CREATE OR REPLACE FUNCTION public.apply_active_promotion_for_amounts(
  p_order_type text,
  p_user_id uuid,
  p_amounts integer[],
  p_worker_route_id uuid DEFAULT NULL,
  p_pricing_route_id uuid DEFAULT NULL
)
RETURNS TABLE (
  ord integer,
  base_cents integer,
  promo_discount_cents integer,
  promotion_id uuid,
  gain_pct numeric(5, 2),
  discount_pct numeric(5, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_promo record;
  v_gain_pct numeric(5, 2) := 0;
  v_discount_pct numeric(5, 2) := 0;
  v_worker_roles text[];
  rec record;
BEGIN
  IF p_amounts IS NULL OR coalesce(array_length(p_amounts, 1), 0) < 1 THEN
    RETURN;
  END IF;

  IF p_order_type = 'bookings' THEN
    v_worker_roles := ARRAY['drivers'];
  ELSIF p_order_type IN ('shipments', 'dependent_shipments') THEN
    v_worker_roles := ARRAY['drivers', 'preparers_shipments'];
  ELSIF p_order_type = 'excursions' THEN
    v_worker_roles := ARRAY['preparers_excursions'];
  ELSE
    v_worker_roles := ARRAY[]::text[];
  END IF;

  SELECT p.* INTO v_promo
  FROM public.promotions p
  WHERE p.is_active = true
    AND now() >= p.start_at
    AND now() <= p.end_at
    AND p_order_type = ANY(p.applies_to)
    AND (
      (p_worker_route_id IS NOT NULL AND p.worker_route_id = p_worker_route_id)
      OR (p_pricing_route_id IS NOT NULL AND p.pricing_route_id = p_pricing_route_id)
      OR (p.worker_route_id IS NULL AND p.pricing_route_id IS NULL)
    )
  ORDER BY
    (CASE WHEN p.worker_route_id = p_worker_route_id THEN 0
          WHEN p.pricing_route_id = p_pricing_route_id THEN 1
          ELSE 2 END),
    GREATEST(COALESCE(p.discount_pct_to_passenger, 0), p.discount_value::numeric) DESC
  LIMIT 1;

  IF v_promo IS NOT NULL THEN
    IF 'passengers' = ANY(v_promo.target_audiences) THEN
      v_discount_pct := COALESCE(v_promo.discount_pct_to_passenger, 0);
      IF v_discount_pct = 0 AND v_promo.discount_type = 'percentage' THEN
        v_discount_pct := LEAST(v_promo.discount_value::numeric, 100);
      END IF;
    END IF;
    IF v_promo.target_audiences && v_worker_roles THEN
      v_gain_pct := COALESCE(v_promo.gain_pct_to_worker, 0);
    END IF;
  END IF;

  FOR rec IN
    SELECT u.ord::integer AS o, u.base::integer AS b
    FROM unnest(p_amounts) WITH ORDINALITY AS u(base, ord)
  LOOP
    ord := rec.o;
    base_cents := rec.b;
    promotion_id := NULL;
    promo_discount_cents := 0;
    gain_pct := 0;
    discount_pct := 0;

    IF v_promo IS NOT NULL AND rec.b >= 1 THEN
      promotion_id := v_promo.id;
      gain_pct := v_gain_pct;
      discount_pct := v_discount_pct;
      IF v_promo.discount_type = 'percentage' THEN
        promo_discount_cents := round(rec.b * (v_discount_pct / 100.0))::integer;
      ELSE
        promo_discount_cents := least(v_promo.discount_value, rec.b);
      END IF;
      IF promo_discount_cents < 0 THEN
        promo_discount_cents := 0;
      END IF;
      IF promo_discount_cents > rec.b THEN
        promo_discount_cents := rec.b;
      END IF;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_active_promotion_for_amounts(text, uuid, integer[], uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_active_promotion_for_amounts(text, uuid, integer[], uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_active_promotion_for_amounts(text, uuid, integer[], uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.apply_active_promotion_for_amounts(text, uuid, integer[], uuid, uuid) IS
  'Versão em lote de apply_active_promotion. Respeita target_audiences igual à versão single-amount.';
