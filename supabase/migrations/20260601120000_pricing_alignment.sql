-- ============================================================================
-- Pricing Alignment — PDF "Fórmulas de Preços App Takeme"
-- ============================================================================
-- Implementa a fórmula literal do PDF (gross-up do % sobre o valor total):
--   Total = (base + adicionais) / (1 - admin_pct + discount_pct - gain_pct)
--   promo_gain      = Total × gain_pct
--   promo_discount  = Total × discount_pct
--   admin_fee       = Total × admin_pct
--   worker_earning  = base + promo_gain - promo_discount
--   admin_earning   = admin_fee + adicionais
--   Total           = worker_earning + admin_earning   (invariante)
--
-- Esta migration apenas adiciona colunas / constraints. A fórmula está na
-- migration 20260601121000_compute_order_pricing.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PROMOTIONS: vínculo a rota + ganho e desconto separados
-- ---------------------------------------------------------------------------
ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS worker_route_id uuid NULL
    REFERENCES public.worker_routes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pricing_route_id uuid NULL
    REFERENCES public.pricing_routes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin_city text NULL,
  ADD COLUMN IF NOT EXISTS discount_pct_to_passenger numeric(5, 2)
    NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.promotions.worker_route_id IS
  'Promoção atrelada a uma rota específica do motorista (origem+destino).';
COMMENT ON COLUMN public.promotions.pricing_route_id IS
  'Promoção atrelada a um trecho do catálogo admin (origem+destino+role).';
COMMENT ON COLUMN public.promotions.origin_city IS
  'Cidade de origem (fallback textual quando rota não é específica).';
COMMENT ON COLUMN public.promotions.discount_pct_to_passenger IS
  'Desconto percentual aplicado ao passageiro sobre o total da viagem/encomenda.';

-- Backfill: migra discount_value→discount_pct_to_passenger quando percentual.
UPDATE public.promotions
SET discount_pct_to_passenger = LEAST(discount_value::numeric, 100)
WHERE discount_type = 'percentage'
  AND discount_pct_to_passenger = 0
  AND discount_value > 0;

CREATE INDEX IF NOT EXISTS idx_promotions_worker_route
  ON public.promotions (worker_route_id)
  WHERE worker_route_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promotions_pricing_route
  ON public.promotions (pricing_route_id)
  WHERE pricing_route_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- SURCHARGE_CATALOG: tipo (viagem/encomenda/preparador_encomendas/preparador_excursoes)
-- ---------------------------------------------------------------------------
ALTER TABLE public.surcharge_catalog
  ADD COLUMN IF NOT EXISTS surcharge_type text NOT NULL DEFAULT 'viagem';

ALTER TABLE public.surcharge_catalog
  DROP CONSTRAINT IF EXISTS surcharge_catalog_type_check;

ALTER TABLE public.surcharge_catalog
  ADD CONSTRAINT surcharge_catalog_type_check CHECK (
    surcharge_type = ANY (ARRAY[
      'viagem'::text,
      'encomenda'::text,
      'preparador_encomendas'::text,
      'preparador_excursoes'::text
    ])
  );

COMMENT ON COLUMN public.surcharge_catalog.surcharge_type IS
  'Tipo de adicional: viagem, encomenda, preparador_encomendas, preparador_excursoes.';

CREATE INDEX IF NOT EXISTS idx_surcharge_catalog_type
  ON public.surcharge_catalog (surcharge_type)
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- SNAPSHOTS DE PEDIDO: novas colunas (gross-up + split split)
-- ---------------------------------------------------------------------------
-- promo_gain_cents       = extra repassado ao worker pela promo
-- worker_earning_cents   = base + promo_gain - promo_discount
-- admin_earning_cents    = admin_fee + pricing_surcharges
-- promo_worker_route_id  = rota da promo aplicada (denormaliza para auditoria)
-- ---------------------------------------------------------------------------

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS promo_gain_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS worker_earning_cents integer NULL,
  ADD COLUMN IF NOT EXISTS admin_earning_cents integer NULL,
  ADD COLUMN IF NOT EXISTS promo_worker_route_id uuid NULL
    REFERENCES public.worker_routes(id) ON DELETE SET NULL;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS promo_gain_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS worker_earning_cents integer NULL,
  ADD COLUMN IF NOT EXISTS admin_earning_cents integer NULL,
  ADD COLUMN IF NOT EXISTS promo_worker_route_id uuid NULL
    REFERENCES public.worker_routes(id) ON DELETE SET NULL;

ALTER TABLE public.dependent_shipments
  ADD COLUMN IF NOT EXISTS promo_gain_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS worker_earning_cents integer NULL,
  ADD COLUMN IF NOT EXISTS admin_earning_cents integer NULL,
  ADD COLUMN IF NOT EXISTS promo_worker_route_id uuid NULL
    REFERENCES public.worker_routes(id) ON DELETE SET NULL;

ALTER TABLE public.excursion_requests
  ADD COLUMN IF NOT EXISTS promo_gain_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS worker_earning_cents integer NULL,
  ADD COLUMN IF NOT EXISTS admin_earning_cents integer NULL,
  ADD COLUMN IF NOT EXISTS promo_worker_route_id uuid NULL
    REFERENCES public.worker_routes(id) ON DELETE SET NULL;

-- Backfill dos pedidos existentes a partir do snapshot antigo:
--   worker_earning ≈ worker_payout antigo (subtotal - platform_fee)
--   admin_earning  ≈ platform_fee antigo
-- Isto preserva a "verdade" do que já foi cobrado, embora seja uma aproximação
-- (em registros antigos surcharges estavam embutidos no subtotal).

UPDATE public.bookings
SET
  worker_earning_cents = COALESCE(pricing_subtotal_cents, amount_cents)
    - COALESCE(platform_fee_cents, 0),
  admin_earning_cents = COALESCE(platform_fee_cents, 0)
WHERE worker_earning_cents IS NULL;

UPDATE public.shipments
SET
  worker_earning_cents = COALESCE(pricing_subtotal_cents, amount_cents)
    - COALESCE(platform_fee_cents, 0),
  admin_earning_cents = COALESCE(platform_fee_cents, 0)
WHERE worker_earning_cents IS NULL;

UPDATE public.dependent_shipments
SET
  worker_earning_cents = COALESCE(pricing_subtotal_cents, amount_cents)
    - COALESCE(platform_fee_cents, 0),
  admin_earning_cents = COALESCE(platform_fee_cents, 0)
WHERE worker_earning_cents IS NULL;

UPDATE public.excursion_requests
SET
  worker_earning_cents = COALESCE(pricing_subtotal_cents, total_amount_cents, 0)
    - COALESCE(platform_fee_cents, 0),
  admin_earning_cents = COALESCE(platform_fee_cents, 0)
WHERE worker_earning_cents IS NULL
  AND (pricing_subtotal_cents IS NOT NULL OR total_amount_cents IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Remove a constraint antiga `amount = subtotal + platform_fee`
-- porque com a nova fórmula (gross-up) `pricing_surcharges_cents` pode estar
-- contabilizado dentro de `admin_earning_cents` e não dentro do subtotal.
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_amount_matches_pricing;
ALTER TABLE public.shipments
  DROP CONSTRAINT IF EXISTS shipments_amount_matches_pricing;
ALTER TABLE public.dependent_shipments
  DROP CONSTRAINT IF EXISTS dependent_shipments_amount_matches_pricing;
ALTER TABLE public.excursion_requests
  DROP CONSTRAINT IF EXISTS excursion_requests_total_matches_pricing;

COMMENT ON COLUMN public.bookings.worker_earning_cents IS
  'Quanto o motorista recebe: base + promo_gain - promo_discount (PDF split).';
COMMENT ON COLUMN public.bookings.admin_earning_cents IS
  'Quanto o admin recebe: admin_fee + adicionais em reais (PDF split).';
COMMENT ON COLUMN public.bookings.promo_gain_cents IS
  'Ganho promocional extra repassado ao motorista (em centavos).';

COMMENT ON COLUMN public.shipments.worker_earning_cents IS
  'Quanto o worker (motorista ou preparador) recebe no split.';
COMMENT ON COLUMN public.shipments.admin_earning_cents IS
  'Quanto o admin recebe no split (0 se preparador de encomendas).';

COMMENT ON COLUMN public.excursion_requests.worker_earning_cents IS
  'Quanto o preparador de excursão recebe no split (admin=0 neste fluxo).';

-- ---------------------------------------------------------------------------
-- PAYOUTS: receipt_url e tabela payout_logs (usados em process-payouts)
-- ---------------------------------------------------------------------------
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS receipt_url text NULL;

COMMENT ON COLUMN public.payouts.receipt_url IS
  'URL do comprovante (Pix manual confirmado pelo admin).';

CREATE TABLE IF NOT EXISTS public.payout_logs (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  payout_id       uuid        NOT NULL REFERENCES public.payouts(id) ON DELETE CASCADE,
  action          text        NOT NULL,
  performed_by    uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  details         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payout_logs_pkey PRIMARY KEY (id),
  CONSTRAINT payout_logs_action_check CHECK (
    action = ANY (ARRAY[
      'auto_released'::text,
      'batch_released'::text,
      'failed'::text,
      'retry'::text,
      'adjusted'::text,
      'note'::text
    ])
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_payout_logs_payout_id
  ON public.payout_logs (payout_id);

CREATE INDEX IF NOT EXISTS idx_payout_logs_created_at
  ON public.payout_logs (created_at DESC);

ALTER TABLE public.payout_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payout_logs_admin_all ON public.payout_logs;
CREATE POLICY payout_logs_admin_all ON public.payout_logs
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS payout_logs_worker_read ON public.payout_logs;
CREATE POLICY payout_logs_worker_read ON public.payout_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.payouts p
      WHERE p.id = payout_logs.payout_id
        AND p.worker_id = auth.uid()
    )
  );

COMMENT ON TABLE public.payout_logs IS
  'Histórico estruturado de ações em payouts (auto_released, batch_released, retry, etc.).';
