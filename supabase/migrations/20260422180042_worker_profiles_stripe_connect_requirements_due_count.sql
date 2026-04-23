-- Espelha o número de campos pendentes em Stripe Account.requirements
-- (currently_due + past_due) para distinguir "em análise passiva" de
-- "ação necessária pelo motorista". Atualizado por:
--   * supabase/functions/stripe-webhook/index.ts (account.updated)
--   * supabase/functions/stripe-connect-sync/index.ts (fallback chamado pelo app)
-- Quando > 0 e details_submitted=true, o app deve mostrar CTA para reabrir o
-- Stripe via Account Link do tipo `account_update` (link de remediação).

alter table public.worker_profiles
  add column if not exists stripe_connect_requirements_due_count integer not null default 0;

comment on column public.worker_profiles.stripe_connect_requirements_due_count is
  'Número de itens em Stripe Account.requirements.currently_due + past_due. Quando > 0, motorista precisa completar/atualizar dados via Account Link account_update.';
