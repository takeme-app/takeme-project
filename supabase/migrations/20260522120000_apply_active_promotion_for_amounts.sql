-- Pré-visualização em lote do desconto da promoção ativa (mesma regra que `apply_active_promotion`),
-- para o app cliente exibir na lista o mesmo valor líquido que o checkout/cartão cobrará.
-- `p_user_id` reservado para futuras regras por adesão; hoje a seleção de promoção é global por `applies_to` + vigência.

CREATE OR REPLACE FUNCTION public.apply_active_promotion_for_amounts(
  p_order_type text,
  p_user_id uuid,
  p_amounts integer[]
)
RETURNS TABLE (
  ord integer,
  base_cents integer,
  promo_discount_cents integer,
  promotion_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_id uuid;
  v_discount_type text;
  v_discount_val integer;
  rec record;
BEGIN
  IF p_amounts IS NULL OR coalesce(array_length(p_amounts, 1), 0) < 1 THEN
    RETURN;
  END IF;

  SELECT p.id, p.discount_type, p.discount_value
  INTO v_id, v_discount_type, v_discount_val
  FROM public.promotions p
  WHERE p.is_active = true
    AND now() >= p.start_at
    AND now() <= p.end_at
    AND p_order_type = ANY(p.applies_to)
  ORDER BY p.discount_value DESC
  LIMIT 1;

  FOR rec IN
    SELECT u.ord::integer AS o, u.base::integer AS b
    FROM unnest(p_amounts) WITH ORDINALITY AS u(base, ord)
  LOOP
    ord := rec.o;
    base_cents := rec.b;
    promotion_id := NULL;
    promo_discount_cents := 0;

    IF v_id IS NOT NULL AND rec.b >= 1 THEN
      promotion_id := v_id;
      IF v_discount_type = 'percentage' THEN
        promo_discount_cents := round(rec.b * (v_discount_val::numeric / 100.0))::integer;
      ELSE
        promo_discount_cents := least(v_discount_val, rec.b);
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

COMMENT ON FUNCTION public.apply_active_promotion_for_amounts(text, uuid, integer[]) IS
  'Para cada valor em p_amounts (ordem preservada), devolve o desconto em centavos da promoção ativa para p_order_type. Alinha lista de viagens ao checkout.';

REVOKE ALL ON FUNCTION public.apply_active_promotion_for_amounts(text, uuid, integer[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_active_promotion_for_amounts(text, uuid, integer[]) TO authenticated, service_role;
