-- ============================================================================
-- Função canônica: compute_order_pricing
-- ============================================================================
-- Implementa o gross-up literal do PDF:
--   denom = 1 - (admin_pct - discount_pct + gain_pct) / 100
--   Total = (base + surcharges) / denom
--   promo_gain     = round(Total × gain_pct / 100)
--   promo_discount = round(Total × discount_pct / 100)
--   admin_fee      = round(Total × admin_pct / 100)
--   worker_earning = base + promo_gain - promo_discount
--   admin_earning  = admin_fee + surcharges
--   Total          = worker_earning + admin_earning (invariante)
--
-- Observação importante sobre a fórmula do PDF:
--   Total = base + gain*Total − discount*Total + admin*Total + adicionais
--   ⇒ Total*(1 − gain + discount − admin) = base + adicionais
--   ⇒ Total = (base + adicionais) / (1 − gain + discount − admin)
--   (o sinal de discount é positivo no denominador)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compute_order_pricing(
  p_base_cents integer,
  p_surcharges_cents integer DEFAULT 0,
  p_admin_pct numeric DEFAULT 0,
  p_gain_pct numeric DEFAULT 0,
  p_discount_pct numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_base       integer := COALESCE(p_base_cents, 0);
  v_surcharges integer := COALESCE(p_surcharges_cents, 0);
  v_admin_pct  numeric := GREATEST(0, COALESCE(p_admin_pct, 0));
  v_gain_pct   numeric := GREATEST(0, COALESCE(p_gain_pct, 0));
  v_disc_pct   numeric := GREATEST(0, COALESCE(p_discount_pct, 0));
  v_denom      numeric;
  v_total      integer;
  v_gain       integer;
  v_disc       integer;
  v_admin_fee  integer;
  v_worker     integer;
  v_admin_earn integer;
BEGIN
  IF v_base < 0 OR v_surcharges < 0 THEN
    RAISE EXCEPTION 'pricing:negative_input';
  END IF;

  -- Fórmula do PDF: denom = 1 − gain% + discount% − admin%
  v_denom := 1.0 - (v_gain_pct / 100.0) + (v_disc_pct / 100.0) - (v_admin_pct / 100.0);

  -- Guarda contra denominadores irreais (> 120% agregado).
  IF v_denom <= 0.05 THEN
    RAISE EXCEPTION 'pricing:denominator_overflow denom=%', v_denom;
  END IF;

  v_total     := GREATEST(0, ROUND((v_base + v_surcharges) / v_denom)::int);
  v_gain      := ROUND(v_total::numeric * v_gain_pct / 100.0)::int;
  v_disc      := ROUND(v_total::numeric * v_disc_pct / 100.0)::int;
  v_admin_fee := ROUND(v_total::numeric * v_admin_pct / 100.0)::int;

  -- Corrige arredondamentos para garantir a invariante exata:
  -- worker + admin_earn = total
  v_worker    := v_base + v_gain - v_disc;
  v_admin_earn := v_total - v_worker;

  RETURN jsonb_build_object(
    'total_cents',          v_total,
    'base_cents',           v_base,
    'surcharges_cents',     v_surcharges,
    'admin_fee_cents',      v_admin_fee,
    'promo_gain_cents',     v_gain,
    'promo_discount_cents', v_disc,
    'worker_earning_cents', v_worker,
    'admin_earning_cents',  v_admin_earn,
    'admin_pct_applied',    v_admin_pct,
    'gain_pct_applied',     v_gain_pct,
    'discount_pct_applied', v_disc_pct
  );
END;
$$;

COMMENT ON FUNCTION public.compute_order_pricing(integer, integer, numeric, numeric, numeric) IS
  'Cálculo canônico do valor total (gross-up PDF). Retorna JSONB com breakdown completo.';

REVOKE ALL ON FUNCTION public.compute_order_pricing(integer, integer, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_order_pricing(integer, integer, numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_order_pricing(integer, integer, numeric, numeric, numeric) TO service_role;

-- ============================================================================
-- apply_active_promotion reescrita: filtra por rota + retorna gain/discount %
-- ============================================================================
-- Mantém a assinatura legada por compatibilidade, mas prioriza promoção
-- específica de rota (worker_route_id ou pricing_route_id) quando passada.
--
-- Retorno:
--   promotion_id, promo_discount_cents, adjusted_admin_pct, gain_pct,
--   discount_pct, worker_route_id
-- ============================================================================

DROP FUNCTION IF EXISTS public.apply_active_promotion(text, uuid, int);

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
BEGIN
  SELECT (value->>'percentage')::numeric(5, 2) INTO v_base_admin_pct
  FROM public.platform_settings
  WHERE key = 'default_admin_pct';

  IF v_base_admin_pct IS NULL THEN
    v_base_admin_pct := 15;
  END IF;

  -- Seleciona a promoção mais prioritária:
  --   1) Match exato de worker_route_id
  --   2) Match exato de pricing_route_id
  --   3) Promoção global (worker_route_id IS NULL AND pricing_route_id IS NULL)
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

  v_discount_pct := COALESCE(v_promo.discount_pct_to_passenger, 0);

  -- Compatibilidade: se discount_pct_to_passenger = 0 mas discount_type = 'percentage',
  -- usa discount_value (enquanto não roda backfill).
  IF v_discount_pct = 0 AND v_promo.discount_type = 'percentage' THEN
    v_discount_pct := LEAST(v_promo.discount_value::numeric, 100);
  END IF;

  v_gain_pct := COALESCE(v_promo.gain_pct_to_worker, 0);

  -- Compatibilidade legada para chamadas que ainda usam promo_discount_cents.
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
  'Aplica promoção ativa priorizando rota (worker_route_id ou pricing_route_id). Retorna %gain e %discount separados (PDF).';

-- ============================================================================
-- apply_active_promotion_for_amounts reescrita: retorna breakdown completo
-- ============================================================================
DROP FUNCTION IF EXISTS public.apply_active_promotion_for_amounts(text, uuid, integer[]);

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
  rec record;
BEGIN
  IF p_amounts IS NULL OR coalesce(array_length(p_amounts, 1), 0) < 1 THEN
    RETURN;
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
    v_discount_pct := COALESCE(v_promo.discount_pct_to_passenger, 0);
    IF v_discount_pct = 0 AND v_promo.discount_type = 'percentage' THEN
      v_discount_pct := LEAST(v_promo.discount_value::numeric, 100);
    END IF;
    v_gain_pct := COALESCE(v_promo.gain_pct_to_worker, 0);
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
  'Versão em lote do apply_active_promotion. Retorna gain_pct e discount_pct aplicáveis a cada valor.';
