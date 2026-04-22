-- Fatia do payout destinada ao preparador em excursion_requests.
--
-- Contexto: excursion_requests.worker_payout_cents e GENERATED
-- (pricing_subtotal_cents - platform_fee_cents) e representa o total a
-- distribuir entre motorista (driver_id) + preparador (preparer_id).
--
-- preparer_payout_cents e uma fatia desse total destinada ao preparador.
-- O driver recebe o restante: driver_amount = worker_payout_cents - preparer_payout_cents.
--
-- Uso: stripe-webhook lê esse campo em payment_intent.succeeded e insere
-- 2 rows em public.payouts (uma por worker) com os valores corretos.
-- manage-excursion-budget popula esse campo ao finalizar o orçamento.
--
-- Invariante: 0 <= preparer_payout_cents <= worker_payout_cents

alter table public.excursion_requests
  add column if not exists preparer_payout_cents integer not null default 0;

alter table public.excursion_requests
  drop constraint if exists excursion_requests_preparer_payout_cents_range;

alter table public.excursion_requests
  add constraint excursion_requests_preparer_payout_cents_range
  check (
    preparer_payout_cents >= 0
    and (
      worker_payout_cents is null
      or preparer_payout_cents <= worker_payout_cents
    )
  );

comment on column public.excursion_requests.preparer_payout_cents is
  'Fatia de worker_payout_cents destinada ao preparer_id. driver_id recebe worker_payout_cents - preparer_payout_cents. Populado pelo manage-excursion-budget ao finalizar orcamento.';
