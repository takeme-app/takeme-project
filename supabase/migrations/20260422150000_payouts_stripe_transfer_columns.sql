-- Rastreio de stripe.transfers.create explicitos para payouts Connect.
--
-- Contexto: process-payouts passa a fazer stripe.transfers.create explicito
-- para entity_type in ('shipment','dependent_shipment','excursion') quando o
-- worker tem stripe_connect_account_id. Precisamos persistir o transfer_id para:
--   1) Idempotencia: evitar transferir de novo se a funcao rodar 2x.
--   2) Refund: process-refund cria /transfers/{id}/reversals antes do refund.
--   3) Auditoria.
--
-- entity_type='booking' NAO usa essas colunas (transfer_data no ato do charge).

alter table public.payouts
  add column if not exists stripe_transfer_id text null,
  add column if not exists stripe_transfer_at timestamptz null,
  add column if not exists stripe_transfer_error text null;

create unique index if not exists payouts_stripe_transfer_id_uniq
  on public.payouts (stripe_transfer_id)
  where stripe_transfer_id is not null;

comment on column public.payouts.stripe_transfer_id is
  'ID do stripe.transfers quando payout Connect foi liberado explicitamente (shipment, dependent_shipment, excursion). NULL para booking (usa transfer_data no charge).';
comment on column public.payouts.stripe_transfer_at is
  'Quando o transfer explicito foi efetivado na Stripe.';
comment on column public.payouts.stripe_transfer_error is
  'Mensagem de erro do ultimo stripe.transfers.create falhado. Ajuda debug sem bloquear retry.';
