-- ============================================================================
-- TAKE ME — Migration Completa (Etapas 1–10)
-- Executar no Supabase SQL Editor em ordem
-- ============================================================================

BEGIN;

-- ============================================================================
-- ETAPA 1: worker_assignments — aceite/recusa com timeout
-- ============================================================================

-- Adicionar novos status ao check constraint
ALTER TABLE public.worker_assignments
  DROP CONSTRAINT IF EXISTS worker_assignments_status_check;

ALTER TABLE public.worker_assignments
  ADD CONSTRAINT worker_assignments_status_check CHECK (
    status = ANY (ARRAY[
      'assigned'::text,
      'accepted'::text,
      'in_progress'::text,
      'completed'::text,
      'cancelled'::text,
      'rejected'::text,
      'expired'::text
    ])
  );

-- Novos campos
ALTER TABLE public.worker_assignments
  ADD COLUMN IF NOT EXISTS rejected_at    timestamptz     NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason text          NULL,
  ADD COLUMN IF NOT EXISTS expires_at     timestamptz     NULL;

COMMENT ON COLUMN public.worker_assignments.expires_at IS
  'Prazo para aceite = horário da corrida - 30 min. Após isso, status vira expired.';


-- ============================================================================
-- ETAPA 2: Tokens de coleta/entrega — shipments e dependent_shipments
-- ============================================================================

-- Função auxiliar para gerar código de 4 dígitos
CREATE OR REPLACE FUNCTION public.generate_4digit_code()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT lpad(floor(random() * 9000 + 1000)::int::text, 4, '0');
$$;

-- shipments
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS pickup_code   text            NULL,
  ADD COLUMN IF NOT EXISTS delivery_code text            NULL,
  ADD COLUMN IF NOT EXISTS picked_up_at  timestamptz     NULL,
  ADD COLUMN IF NOT EXISTS delivered_at  timestamptz     NULL;

-- dependent_shipments
ALTER TABLE public.dependent_shipments
  ADD COLUMN IF NOT EXISTS pickup_code   text            NULL,
  ADD COLUMN IF NOT EXISTS delivery_code text            NULL,
  ADD COLUMN IF NOT EXISTS picked_up_at  timestamptz     NULL,
  ADD COLUMN IF NOT EXISTS delivered_at  timestamptz     NULL;

-- Trigger: gerar códigos automaticamente ao criar shipment
CREATE OR REPLACE FUNCTION public.generate_shipment_codes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pickup_code IS NULL THEN
    NEW.pickup_code := public.generate_4digit_code();
  END IF;
  IF NEW.delivery_code IS NULL THEN
    NEW.delivery_code := public.generate_4digit_code();
  END IF;
  -- Garantir que os dois códigos sejam diferentes
  WHILE NEW.delivery_code = NEW.pickup_code LOOP
    NEW.delivery_code := public.generate_4digit_code();
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shipments_generate_codes ON public.shipments;
CREATE TRIGGER trg_shipments_generate_codes
  BEFORE INSERT ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_shipment_codes();

DROP TRIGGER IF EXISTS trg_dependent_shipments_generate_codes ON public.dependent_shipments;
CREATE TRIGGER trg_dependent_shipments_generate_codes
  BEFORE INSERT ON public.dependent_shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_shipment_codes();


-- ============================================================================
-- ETAPA 3: Bases (galpões) + vínculo preparador + vínculo encomenda
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bases (
  id          uuid            NOT NULL DEFAULT gen_random_uuid(),
  name        text            NOT NULL,
  address     text            NOT NULL,
  city        text            NOT NULL,
  state       text            NULL,
  lat         double precision NULL,
  lng         double precision NULL,
  is_active   boolean         NOT NULL DEFAULT true,
  created_at  timestamptz     NOT NULL DEFAULT now(),
  updated_at  timestamptz     NOT NULL DEFAULT now(),
  CONSTRAINT bases_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_bases_city ON public.bases USING btree (city);
CREATE INDEX IF NOT EXISTS idx_bases_active ON public.bases USING btree (is_active) WHERE is_active = true;

-- Vincular preparador de encomendas a uma base
ALTER TABLE public.worker_profiles
  ADD COLUMN IF NOT EXISTS base_id uuid NULL;

ALTER TABLE public.worker_profiles
  DROP CONSTRAINT IF EXISTS worker_profiles_base_id_fkey;

ALTER TABLE public.worker_profiles
  ADD CONSTRAINT worker_profiles_base_id_fkey
    FOREIGN KEY (base_id) REFERENCES public.bases (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.worker_profiles.base_id IS
  'Base fixa do preparador de encomendas (role=preparer, subtype=shipments).';

-- Vincular encomenda a uma base (quando cidade tem base e pacote não é grande)
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS base_id uuid NULL;

ALTER TABLE public.shipments
  DROP CONSTRAINT IF EXISTS shipments_base_id_fkey;

ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_base_id_fkey
    FOREIGN KEY (base_id) REFERENCES public.bases (id) ON DELETE SET NULL;


-- ============================================================================
-- ETAPA 4: Percentual de bagageira (manual, visual)
-- ============================================================================

ALTER TABLE public.scheduled_trips
  ADD COLUMN IF NOT EXISTS trunk_occupancy_pct smallint NOT NULL DEFAULT 0;

ALTER TABLE public.scheduled_trips
  DROP CONSTRAINT IF EXISTS scheduled_trips_trunk_occupancy_check;

ALTER TABLE public.scheduled_trips
  ADD CONSTRAINT scheduled_trips_trunk_occupancy_check
    CHECK (trunk_occupancy_pct >= 0 AND trunk_occupancy_pct <= 100);

COMMENT ON COLUMN public.scheduled_trips.trunk_occupancy_pct IS
  'Percentual de ocupação do bagageiro (0-100). Apenas visual, não bloqueia aceite.';


-- ============================================================================
-- ETAPA 5: Promoções
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.promotions (
  id                uuid            NOT NULL DEFAULT gen_random_uuid(),
  title             text            NOT NULL,
  description       text            NULL,
  start_at          timestamptz     NOT NULL,
  end_at            timestamptz     NOT NULL,
  target_audiences  text[]          NOT NULL,
  discount_type     text            NOT NULL,
  discount_value    integer         NOT NULL,
  applies_to        text[]          NOT NULL,
  is_active         boolean         NOT NULL DEFAULT true,
  created_by        uuid            NULL,
  created_at        timestamptz     NOT NULL DEFAULT now(),
  updated_at        timestamptz     NOT NULL DEFAULT now(),
  CONSTRAINT promotions_pkey PRIMARY KEY (id),
  CONSTRAINT promotions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT promotions_discount_type_check CHECK (
    discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text])
  ),
  CONSTRAINT promotions_discount_value_check CHECK (discount_value > 0),
  CONSTRAINT promotions_dates_check CHECK (end_at > start_at)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions
  USING btree (is_active, start_at, end_at);

COMMENT ON COLUMN public.promotions.target_audiences IS
  'Array: drivers, preparers_shipments, preparers_excursions, passengers';
COMMENT ON COLUMN public.promotions.applies_to IS
  'Array: bookings, shipments, dependent_shipments, excursions';
COMMENT ON COLUMN public.promotions.discount_value IS
  'Percentual (ex: 10 = 10%) ou centavos (ex: 500 = R$5,00) conforme discount_type';

-- Adicionar promotion_id nas tabelas de transação
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS promotion_id uuid NULL;
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_promotion_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_promotion_id_fkey
    FOREIGN KEY (promotion_id) REFERENCES public.promotions (id) ON DELETE SET NULL;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS promotion_id uuid NULL;
ALTER TABLE public.shipments
  DROP CONSTRAINT IF EXISTS shipments_promotion_id_fkey;
ALTER TABLE public.shipments
  ADD CONSTRAINT shipments_promotion_id_fkey
    FOREIGN KEY (promotion_id) REFERENCES public.promotions (id) ON DELETE SET NULL;

ALTER TABLE public.dependent_shipments
  ADD COLUMN IF NOT EXISTS promotion_id uuid NULL;
ALTER TABLE public.dependent_shipments
  DROP CONSTRAINT IF EXISTS dependent_shipments_promotion_id_fkey;
ALTER TABLE public.dependent_shipments
  ADD CONSTRAINT dependent_shipments_promotion_id_fkey
    FOREIGN KEY (promotion_id) REFERENCES public.promotions (id) ON DELETE SET NULL;

ALTER TABLE public.excursion_requests
  ADD COLUMN IF NOT EXISTS promotion_id uuid NULL;
ALTER TABLE public.excursion_requests
  DROP CONSTRAINT IF EXISTS excursion_requests_promotion_id_fkey;
ALTER TABLE public.excursion_requests
  ADD CONSTRAINT excursion_requests_promotion_id_fkey
    FOREIGN KEY (promotion_id) REFERENCES public.promotions (id) ON DELETE SET NULL;


-- ============================================================================
-- ETAPA 6: Trechos de precificação + catálogo de adicionais + payouts
-- ============================================================================

-- Catálogo de adicionais (global, admin cadastra)
CREATE TABLE IF NOT EXISTS public.surcharge_catalog (
  id                  uuid            NOT NULL DEFAULT gen_random_uuid(),
  name                text            NOT NULL,
  description         text            NULL,
  default_value_cents integer         NOT NULL DEFAULT 0,
  surcharge_mode      text            NOT NULL DEFAULT 'manual',
  is_active           boolean         NOT NULL DEFAULT true,
  created_at          timestamptz     NOT NULL DEFAULT now(),
  updated_at          timestamptz     NOT NULL DEFAULT now(),
  CONSTRAINT surcharge_catalog_pkey PRIMARY KEY (id),
  CONSTRAINT surcharge_catalog_mode_check CHECK (
    surcharge_mode = ANY (ARRAY['automatic'::text, 'manual'::text])
  ),
  CONSTRAINT surcharge_catalog_value_check CHECK (default_value_cents >= 0)
) TABLESPACE pg_default;

-- Trechos de precificação por role (admin)
CREATE TABLE IF NOT EXISTS public.pricing_routes (
  id                      uuid            NOT NULL DEFAULT gen_random_uuid(),
  role_type               text            NOT NULL,
  title                   text            NULL,
  origin_address          text            NULL,
  destination_address     text            NOT NULL,
  pricing_mode            text            NOT NULL,
  price_cents             integer         NOT NULL,
  driver_pct              numeric(5,2)    NOT NULL DEFAULT 0,
  admin_pct               numeric(5,2)    NOT NULL DEFAULT 0,
  accepted_payment_methods text[]         NOT NULL DEFAULT '{}',
  departure_at            timestamptz     NULL,
  return_at               timestamptz     NULL,
  is_active               boolean         NOT NULL DEFAULT true,
  created_by              uuid            NULL,
  created_at              timestamptz     NOT NULL DEFAULT now(),
  updated_at              timestamptz     NOT NULL DEFAULT now(),
  CONSTRAINT pricing_routes_pkey PRIMARY KEY (id),
  CONSTRAINT pricing_routes_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT pricing_routes_role_type_check CHECK (
    role_type = ANY (ARRAY[
      'driver'::text,
      'preparer_excursions'::text,
      'preparer_shipments'::text
    ])
  ),
  CONSTRAINT pricing_routes_pricing_mode_check CHECK (
    pricing_mode = ANY (ARRAY[
      'daily_rate'::text,
      'per_km'::text,
      'fixed'::text
    ])
  ),
  CONSTRAINT pricing_routes_price_check CHECK (price_cents >= 0),
  CONSTRAINT pricing_routes_pct_check CHECK (driver_pct >= 0 AND admin_pct >= 0)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_pricing_routes_role ON public.pricing_routes USING btree (role_type);
CREATE INDEX IF NOT EXISTS idx_pricing_routes_active ON public.pricing_routes USING btree (is_active)
  WHERE is_active = true;

COMMENT ON COLUMN public.pricing_routes.title IS
  'Título da promoção/trecho (usado para motorista).';
COMMENT ON COLUMN public.pricing_routes.origin_address IS
  'Motorista usa só destino; preparadores usam origem e destino.';
COMMENT ON COLUMN public.pricing_routes.pricing_mode IS
  'daily_rate = valor da diária, per_km = valor por km, fixed = valor fixo.';

-- Ligação trecho ↔ adicionais do catálogo
CREATE TABLE IF NOT EXISTS public.pricing_route_surcharges (
  id                uuid            NOT NULL DEFAULT gen_random_uuid(),
  pricing_route_id  uuid            NOT NULL,
  surcharge_id      uuid            NOT NULL,
  value_cents       integer         NULL,
  created_at        timestamptz     NOT NULL DEFAULT now(),
  CONSTRAINT pricing_route_surcharges_pkey PRIMARY KEY (id),
  CONSTRAINT pricing_route_surcharges_route_fkey
    FOREIGN KEY (pricing_route_id) REFERENCES public.pricing_routes (id) ON DELETE CASCADE,
  CONSTRAINT pricing_route_surcharges_surcharge_fkey
    FOREIGN KEY (surcharge_id) REFERENCES public.surcharge_catalog (id) ON DELETE CASCADE,
  CONSTRAINT pricing_route_surcharges_unique
    UNIQUE (pricing_route_id, surcharge_id)
) TABLESPACE pg_default;

COMMENT ON COLUMN public.pricing_route_surcharges.value_cents IS
  'Sobrescreve o default_value_cents do catálogo, se informado.';

-- Payouts — registro de pagamentos aos motoristas/preparadores
CREATE TABLE IF NOT EXISTS public.payouts (
  id                  uuid            NOT NULL DEFAULT gen_random_uuid(),
  worker_id           uuid            NOT NULL,
  entity_type         text            NOT NULL,
  entity_id           uuid            NOT NULL,
  gross_amount_cents  integer         NOT NULL,
  worker_amount_cents integer         NOT NULL,
  admin_amount_cents  integer         NOT NULL,
  surcharges_cents    integer         NOT NULL DEFAULT 0,
  promotion_discount_cents integer    NOT NULL DEFAULT 0,
  payout_method       text            NOT NULL DEFAULT 'pix',
  status              text            NOT NULL DEFAULT 'pending',
  paid_at             timestamptz     NULL,
  period_start        date            NULL,
  period_end          date            NULL,
  created_at          timestamptz     NOT NULL DEFAULT now(),
  updated_at          timestamptz     NOT NULL DEFAULT now(),
  CONSTRAINT payouts_pkey PRIMARY KEY (id),
  CONSTRAINT payouts_worker_id_fkey
    FOREIGN KEY (worker_id) REFERENCES public.worker_profiles (id) ON DELETE RESTRICT,
  CONSTRAINT payouts_entity_type_check CHECK (
    entity_type = ANY (ARRAY[
      'booking'::text,
      'shipment'::text,
      'dependent_shipment'::text,
      'excursion'::text
    ])
  ),
  CONSTRAINT payouts_payout_method_check CHECK (
    payout_method = ANY (ARRAY[
      'pix'::text,
      'fixed_monthly'::text,
      'fixed_weekly'::text
    ])
  ),
  CONSTRAINT payouts_status_check CHECK (
    status = ANY (ARRAY[
      'pending'::text,
      'processing'::text,
      'paid'::text,
      'failed'::text
    ])
  ),
  CONSTRAINT payouts_amounts_check CHECK (
    gross_amount_cents >= 0
    AND worker_amount_cents >= 0
    AND admin_amount_cents >= 0
    AND surcharges_cents >= 0
    AND promotion_discount_cents >= 0
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_payouts_worker_id ON public.payouts USING btree (worker_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts USING btree (status);
CREATE INDEX IF NOT EXISTS idx_payouts_entity ON public.payouts USING btree (entity_type, entity_id);

COMMENT ON COLUMN public.payouts.period_start IS
  'Início do período (para modo fixed_monthly ou fixed_weekly).';
COMMENT ON COLUMN public.payouts.period_end IS
  'Fim do período (para modo fixed_monthly ou fixed_weekly).';


-- ============================================================================
-- ETAPA 7: Orçamento de excursão (JSONB estruturado)
-- ============================================================================

ALTER TABLE public.excursion_requests
  ADD COLUMN IF NOT EXISTS budget_created_by uuid          NULL,
  ADD COLUMN IF NOT EXISTS budget_created_at timestamptz   NULL,
  ADD COLUMN IF NOT EXISTS budget_accepted_at timestamptz  NULL;

ALTER TABLE public.excursion_requests
  DROP CONSTRAINT IF EXISTS excursion_requests_budget_created_by_fkey;

ALTER TABLE public.excursion_requests
  ADD CONSTRAINT excursion_requests_budget_created_by_fkey
    FOREIGN KEY (budget_created_by) REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.excursion_requests.budget_lines IS
  'Schema JSONB: { team: [{role, name, worker_id, value_cents}], basic_items: [{name, quantity, value_cents}], additional_services: [{name, quantity, value_cents}], recreation_items: [{name, quantity, value_cents}], discount: {type, value}, total_cents }';


-- ============================================================================
-- ETAPA 8: Retenção de mensagens — cron job para limpar > 3 meses
-- ============================================================================

-- Habilitar pg_cron (se ainda não habilitado no projeto Supabase)
-- No dashboard: Database > Extensions > pg_cron > Enable
-- Ou via SQL:
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Função de limpeza
CREATE OR REPLACE FUNCTION public.cleanup_old_conversations()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Deletar conversas (e mensagens via CASCADE) com mais de 3 meses
  DELETE FROM public.conversations
  WHERE created_at < now() - interval '3 months';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count > 0 THEN
    RAISE NOTICE 'cleanup_old_conversations: % conversas removidas', deleted_count;
  END IF;
END;
$$;

-- Agendar cron: rodar todo dia às 03:00 UTC
SELECT cron.schedule(
  'cleanup-old-conversations',
  '0 3 * * *',
  $$SELECT public.cleanup_old_conversations();$$
);


-- ============================================================================
-- ETAPA 9: Histórico de status (timeline) — todas as entidades
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.status_history (
  id          uuid            NOT NULL DEFAULT gen_random_uuid(),
  entity_type text            NOT NULL,
  entity_id   uuid            NOT NULL,
  status      text            NOT NULL,
  label       text            NULL,
  changed_by  uuid            NULL,
  changed_at  timestamptz     NOT NULL DEFAULT now(),
  CONSTRAINT status_history_pkey PRIMARY KEY (id),
  CONSTRAINT status_history_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT status_history_entity_type_check CHECK (
    entity_type = ANY (ARRAY[
      'booking'::text,
      'shipment'::text,
      'dependent_shipment'::text,
      'excursion'::text
    ])
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_status_history_entity
  ON public.status_history USING btree (entity_type, entity_id, changed_at);

-- Trigger genérico para registrar mudança de status
CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  etype text;
BEGIN
  -- Determinar entity_type pelo nome da tabela
  CASE TG_TABLE_NAME
    WHEN 'bookings'             THEN etype := 'booking';
    WHEN 'shipments'            THEN etype := 'shipment';
    WHEN 'dependent_shipments'  THEN etype := 'dependent_shipment';
    WHEN 'excursion_requests'   THEN etype := 'excursion';
    ELSE etype := TG_TABLE_NAME;
  END CASE;

  -- Inserir somente se o status mudou (ou é INSERT)
  IF TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.status_history (entity_type, entity_id, status, changed_at)
    VALUES (etype, NEW.id, NEW.status, now());
  END IF;

  RETURN NEW;
END;
$$;

-- Triggers em cada tabela
DROP TRIGGER IF EXISTS trg_bookings_status_history ON public.bookings;
CREATE TRIGGER trg_bookings_status_history
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_status_change();

DROP TRIGGER IF EXISTS trg_shipments_status_history ON public.shipments;
CREATE TRIGGER trg_shipments_status_history
  AFTER INSERT OR UPDATE OF status ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_status_change();

DROP TRIGGER IF EXISTS trg_dependent_shipments_status_history ON public.dependent_shipments;
CREATE TRIGGER trg_dependent_shipments_status_history
  AFTER INSERT OR UPDATE OF status ON public.dependent_shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_status_change();

DROP TRIGGER IF EXISTS trg_excursion_requests_status_history ON public.excursion_requests;
CREATE TRIGGER trg_excursion_requests_status_history
  AFTER INSERT OR UPDATE OF status ON public.excursion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.log_status_change();


-- ============================================================================
-- ETAPA 10: Navegação da excursão (ida/volta)
-- ============================================================================

ALTER TABLE public.excursion_requests
  ADD COLUMN IF NOT EXISTS navigation_phase text NULL;

ALTER TABLE public.excursion_requests
  DROP CONSTRAINT IF EXISTS excursion_requests_navigation_phase_check;

ALTER TABLE public.excursion_requests
  ADD CONSTRAINT excursion_requests_navigation_phase_check CHECK (
    navigation_phase IS NULL
    OR navigation_phase = ANY (ARRAY[
      'outbound'::text,
      'return'::text,
      'completed'::text
    ])
  );

COMMENT ON COLUMN public.excursion_requests.navigation_phase IS
  'Fase atual da excursão: outbound (ida), return (volta), completed (concluída).';


-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================

COMMIT;
