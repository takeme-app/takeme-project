-- Snapshot de precificação nos pedidos (regra acordada):
-- subtotal = base + surcharges - promo (>= 0)
-- platform_fee = round(subtotal * admin_pct / 100) — fonte: pricing_routes.admin_pct no momento da compra
-- total pago pelo cliente = subtotal + platform_fee (= amount_cents / total_amount_cents)
-- worker_payout (motorista/preparador) = subtotal - platform_fee (sem segundo split)

-- ---------------------------------------------------------------------------
-- BOOKINGS (viagem compartilhada)
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pricing_route_id uuid REFERENCES public.pricing_routes (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS price_route_base_cents integer,
  ADD COLUMN IF NOT EXISTS pricing_surcharges_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_discount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_subtotal_cents integer,
  ADD COLUMN IF NOT EXISTS platform_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_pct_applied numeric(5, 2);

COMMENT ON COLUMN public.bookings.pricing_route_id IS 'Trecho de pricing usado no snapshot (opcional).';
COMMENT ON COLUMN public.bookings.price_route_base_cents IS 'Valor do trecho/catálogo no momento da compra, em centavos.';
COMMENT ON COLUMN public.bookings.pricing_surcharges_cents IS 'Soma dos adicionais (fim de semana, noturno, feriado, etc.).';
COMMENT ON COLUMN public.bookings.promo_discount_cents IS 'Desconto promocional em centavos (>= 0).';
COMMENT ON COLUMN public.bookings.pricing_subtotal_cents IS 'max(0, base + surcharges - promo) antes da taxa de plataforma.';
COMMENT ON COLUMN public.bookings.platform_fee_cents IS 'Taxa da plataforma (admin) em centavos.';
COMMENT ON COLUMN public.bookings.admin_pct_applied IS 'Percentual admin aplicado no cálculo (snapshot).';
COMMENT ON COLUMN public.bookings.amount_cents IS 'Total pago pelo cliente = pricing_subtotal_cents + platform_fee_cents (congelado na compra).';

-- ---------------------------------------------------------------------------
-- SHIPMENTS (encomendas)
-- ---------------------------------------------------------------------------
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS pricing_route_id uuid REFERENCES public.pricing_routes (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS price_route_base_cents integer,
  ADD COLUMN IF NOT EXISTS pricing_surcharges_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_discount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_subtotal_cents integer,
  ADD COLUMN IF NOT EXISTS platform_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_pct_applied numeric(5, 2);

COMMENT ON COLUMN public.shipments.amount_cents IS 'Total pago pelo cliente = pricing_subtotal_cents + platform_fee_cents (congelado na compra).';
COMMENT ON COLUMN public.shipments.pricing_subtotal_cents IS 'Subtotal antes da taxa de plataforma.';
COMMENT ON COLUMN public.shipments.platform_fee_cents IS 'Taxa da plataforma em centavos.';

-- ---------------------------------------------------------------------------
-- DEPENDENT_SHIPMENTS
-- ---------------------------------------------------------------------------
ALTER TABLE public.dependent_shipments
  ADD COLUMN IF NOT EXISTS pricing_route_id uuid REFERENCES public.pricing_routes (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS price_route_base_cents integer,
  ADD COLUMN IF NOT EXISTS pricing_surcharges_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_discount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_subtotal_cents integer,
  ADD COLUMN IF NOT EXISTS platform_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_pct_applied numeric(5, 2);

COMMENT ON COLUMN public.dependent_shipments.amount_cents IS 'Total pago = pricing_subtotal_cents + platform_fee_cents.';

-- ---------------------------------------------------------------------------
-- EXCURSION_REQUESTS (orçamento: total pode ser null até quoted)
-- ---------------------------------------------------------------------------
ALTER TABLE public.excursion_requests
  ADD COLUMN IF NOT EXISTS pricing_route_id uuid REFERENCES public.pricing_routes (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS price_route_base_cents integer,
  ADD COLUMN IF NOT EXISTS pricing_surcharges_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_discount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_subtotal_cents integer,
  ADD COLUMN IF NOT EXISTS platform_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_pct_applied numeric(5, 2);

COMMENT ON COLUMN public.excursion_requests.total_amount_cents IS 'Total pago pelo cliente quando definido; = pricing_subtotal_cents + platform_fee_cents.';
COMMENT ON COLUMN public.excursion_requests.pricing_subtotal_cents IS 'Subtotal antes da taxa de plataforma (após orçamento).';

-- ---------------------------------------------------------------------------
-- Backfill: dados existentes tratados como “sem taxa de plataforma explícita”
-- ---------------------------------------------------------------------------
UPDATE public.bookings
SET
  price_route_base_cents = COALESCE(price_route_base_cents, amount_cents),
  pricing_subtotal_cents = COALESCE(pricing_subtotal_cents, amount_cents),
  platform_fee_cents = 0
WHERE pricing_subtotal_cents IS NULL;

UPDATE public.shipments
SET
  price_route_base_cents = COALESCE(price_route_base_cents, amount_cents),
  pricing_subtotal_cents = COALESCE(pricing_subtotal_cents, amount_cents),
  platform_fee_cents = 0
WHERE pricing_subtotal_cents IS NULL;

UPDATE public.dependent_shipments
SET
  price_route_base_cents = COALESCE(price_route_base_cents, amount_cents),
  pricing_subtotal_cents = COALESCE(pricing_subtotal_cents, amount_cents),
  platform_fee_cents = 0
WHERE pricing_subtotal_cents IS NULL;

-- Excursões já com total: backfill; onde total é null mantém subtotal null
UPDATE public.excursion_requests
SET
  price_route_base_cents = COALESCE(price_route_base_cents, total_amount_cents),
  pricing_subtotal_cents = COALESCE(pricing_subtotal_cents, total_amount_cents),
  platform_fee_cents = 0
WHERE total_amount_cents IS NOT NULL
  AND pricing_subtotal_cents IS NULL;

-- NOT NULL onde sempre houve valor
ALTER TABLE public.bookings
  ALTER COLUMN price_route_base_cents SET NOT NULL,
  ALTER COLUMN pricing_subtotal_cents SET NOT NULL;

ALTER TABLE public.shipments
  ALTER COLUMN price_route_base_cents SET NOT NULL,
  ALTER COLUMN pricing_subtotal_cents SET NOT NULL;

ALTER TABLE public.dependent_shipments
  ALTER COLUMN price_route_base_cents SET NOT NULL,
  ALTER COLUMN pricing_subtotal_cents SET NOT NULL;

-- excursion_requests: subtotal/base permanecem nullable até orçamento

-- ---------------------------------------------------------------------------
-- Colunas geradas: repasse líquido ao worker (subtotal - taxa plataforma)
-- (Após backfill para linhas existentes.)
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings
  DROP COLUMN IF EXISTS worker_payout_cents;
ALTER TABLE public.bookings
  ADD COLUMN worker_payout_cents integer
  GENERATED ALWAYS AS (
    CASE
      WHEN pricing_subtotal_cents IS NULL THEN NULL
      ELSE pricing_subtotal_cents - platform_fee_cents
    END
  ) STORED;

ALTER TABLE public.shipments
  DROP COLUMN IF EXISTS worker_payout_cents;
ALTER TABLE public.shipments
  ADD COLUMN worker_payout_cents integer
  GENERATED ALWAYS AS (
    CASE
      WHEN pricing_subtotal_cents IS NULL THEN NULL
      ELSE pricing_subtotal_cents - platform_fee_cents
    END
  ) STORED;

ALTER TABLE public.dependent_shipments
  DROP COLUMN IF EXISTS worker_payout_cents;
ALTER TABLE public.dependent_shipments
  ADD COLUMN worker_payout_cents integer
  GENERATED ALWAYS AS (
    CASE
      WHEN pricing_subtotal_cents IS NULL THEN NULL
      ELSE pricing_subtotal_cents - platform_fee_cents
    END
  ) STORED;

ALTER TABLE public.excursion_requests
  DROP COLUMN IF EXISTS worker_payout_cents;
ALTER TABLE public.excursion_requests
  ADD COLUMN worker_payout_cents integer
  GENERATED ALWAYS AS (
    CASE
      WHEN pricing_subtotal_cents IS NULL THEN NULL
      ELSE pricing_subtotal_cents - platform_fee_cents
    END
  ) STORED;

COMMENT ON COLUMN public.bookings.worker_payout_cents IS 'Snapshot: subtotal - platform_fee (sem segundo split).';
COMMENT ON COLUMN public.shipments.worker_payout_cents IS 'Snapshot: subtotal - platform_fee.';
COMMENT ON COLUMN public.dependent_shipments.worker_payout_cents IS 'Snapshot: subtotal - platform_fee.';
COMMENT ON COLUMN public.excursion_requests.worker_payout_cents IS 'Snapshot: subtotal - platform_fee (quando subtotal definido).';

-- ---------------------------------------------------------------------------
-- Integridade: total = subtotal + taxa plataforma
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_amount_matches_pricing;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_amount_matches_pricing
  CHECK (amount_cents = pricing_subtotal_cents + platform_fee_cents);

ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_amount_matches_pricing;
ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_amount_matches_pricing
  CHECK (amount_cents = pricing_subtotal_cents + platform_fee_cents);

ALTER TABLE public.dependent_shipments DROP CONSTRAINT IF EXISTS dependent_shipments_amount_matches_pricing;
ALTER TABLE public.dependent_shipments
  ADD CONSTRAINT dependent_shipments_amount_matches_pricing
  CHECK (amount_cents = pricing_subtotal_cents + platform_fee_cents);

ALTER TABLE public.excursion_requests DROP CONSTRAINT IF EXISTS excursion_requests_total_matches_pricing;
ALTER TABLE public.excursion_requests
  ADD CONSTRAINT excursion_requests_total_matches_pricing
  CHECK (
    total_amount_cents IS NULL
    OR (
      pricing_subtotal_cents IS NOT NULL
      AND total_amount_cents = pricing_subtotal_cents + platform_fee_cents
    )
  );

-- ---------------------------------------------------------------------------
-- Ajustes semanais do motorista (fim de semana / noturno / feriado %) — UI roteiro da semana
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.worker_weekly_price_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  worker_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  week_start date NOT NULL,
  weekend_surcharge_pct numeric(5, 2) NOT NULL DEFAULT 0 CHECK (weekend_surcharge_pct >= 0),
  night_surcharge_pct numeric(5, 2) NOT NULL DEFAULT 0 CHECK (night_surcharge_pct >= 0),
  holiday_surcharge_pct numeric(5, 2) NOT NULL DEFAULT 0 CHECK (holiday_surcharge_pct >= 0),
  created_at timestamptz NOT NULL DEFAULT now (),
  updated_at timestamptz NOT NULL DEFAULT now (),
  UNIQUE (worker_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_worker_weekly_adj_worker ON public.worker_weekly_price_adjustments (worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_weekly_adj_week ON public.worker_weekly_price_adjustments (week_start);

COMMENT ON TABLE public.worker_weekly_price_adjustments IS
  'Percentuais de adicional por semana (ex.: fim de semana, noturno, feriado). Aplicados sobre a base no app/RPC; valores finais vão para pricing_surcharges_cents no pedido.';

ALTER TABLE public.worker_weekly_price_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workers_manage_own_weekly_adjustments"
  ON public.worker_weekly_price_adjustments
  FOR ALL
  USING (auth.uid () = worker_id)
  WITH CHECK (auth.uid () = worker_id);

-- ---------------------------------------------------------------------------
-- Função auxiliar (documentação + uso futuro em RPC): cálculo simples da taxa
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_platform_fee_cents (
  p_subtotal_cents integer,
  p_admin_pct numeric
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_subtotal_cents IS NULL THEN NULL
    WHEN p_subtotal_cents <= 0 THEN 0
    WHEN p_admin_pct IS NULL OR p_admin_pct <= 0 THEN 0
    ELSE GREATEST(
      0,
      ROUND(p_subtotal_cents * (p_admin_pct / 100.0))::integer
    )
  END;
$$;

COMMENT ON FUNCTION public.compute_platform_fee_cents (integer, numeric) IS
  'Taxa de plataforma em centavos: round(subtotal * admin_pct/100).';

REVOKE ALL ON FUNCTION public.compute_platform_fee_cents (integer, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_platform_fee_cents (integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_platform_fee_cents (integer, numeric) TO service_role;
