-- Campos em Stripe Account.requirements.pending_verification: já enviados pelo
-- conectado, aguardando análise da Stripe (ex.: PEP / representante).
-- Diferente de currently_due/past_due (ação obrigatória → action_required no app).

alter table public.worker_profiles
  add column if not exists stripe_connect_pending_verification_count integer not null default 0;

comment on column public.worker_profiles.stripe_connect_pending_verification_count is
  'Número de itens em Stripe Account.requirements.pending_verification. Quando > 0, a Stripe está analisando dados já enviados — UI pode explicar isso sem CTA de account_update.';
