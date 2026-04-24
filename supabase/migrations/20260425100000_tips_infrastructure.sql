-- Infraestrutura de gorjeta (tip) com cobrança real via Stripe
-- Adiciona colunas em bookings/shipments/dependent_shipments para rastrear
-- o PaymentIntent específico da gorjeta (separado do pagamento da viagem/envio).
-- Política de produto: 100% da gorjeta vai para o motorista (sem taxa da
-- plataforma). O botão só aparece quando a corrida/envio foi concluído.

begin;

-- ── bookings ────────────────────────────────────────────────────────────────
alter table public.bookings
  add column if not exists tip_cents integer,
  add column if not exists tip_payment_intent_id text,
  add column if not exists tip_charge_id text,
  add column if not exists tip_paid_at timestamptz,
  add column if not exists tip_status text;

alter table public.bookings
  drop constraint if exists bookings_tip_status_check;

alter table public.bookings
  add constraint bookings_tip_status_check
  check (tip_status is null or tip_status in ('pending','succeeded','failed','refunded'));

create index if not exists bookings_tip_payment_intent_id_idx
  on public.bookings (tip_payment_intent_id)
  where tip_payment_intent_id is not null;

-- ── shipments ──────────────────────────────────────────────────────────────
-- tip_cents já existe; adiciona infra de cobrança.
alter table public.shipments
  add column if not exists tip_payment_intent_id text,
  add column if not exists tip_charge_id text,
  add column if not exists tip_paid_at timestamptz,
  add column if not exists tip_status text;

alter table public.shipments
  drop constraint if exists shipments_tip_status_check;

alter table public.shipments
  add constraint shipments_tip_status_check
  check (tip_status is null or tip_status in ('pending','succeeded','failed','refunded'));

create index if not exists shipments_tip_payment_intent_id_idx
  on public.shipments (tip_payment_intent_id)
  where tip_payment_intent_id is not null;

-- ── dependent_shipments ────────────────────────────────────────────────────
alter table public.dependent_shipments
  add column if not exists tip_payment_intent_id text,
  add column if not exists tip_charge_id text,
  add column if not exists tip_paid_at timestamptz,
  add column if not exists tip_status text;

alter table public.dependent_shipments
  drop constraint if exists dependent_shipments_tip_status_check;

alter table public.dependent_shipments
  add constraint dependent_shipments_tip_status_check
  check (tip_status is null or tip_status in ('pending','succeeded','failed','refunded'));

create index if not exists dependent_shipments_tip_payment_intent_id_idx
  on public.dependent_shipments (tip_payment_intent_id)
  where tip_payment_intent_id is not null;

commit;
