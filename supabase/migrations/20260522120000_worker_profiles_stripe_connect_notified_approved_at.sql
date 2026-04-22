-- Idempotência para notificação "Stripe aprovou seu cadastro".
-- Sem isso, o webhook `account.updated` (que pode chegar várias vezes) e o
-- fallback `stripe-connect-sync` poderiam disparar push+email duplicados cada
-- vez que o motorista abre o app após aprovação.

alter table public.worker_profiles
  add column if not exists stripe_connect_notified_approved_at timestamptz null;

comment on column public.worker_profiles.stripe_connect_notified_approved_at is
  'Quando a notificação de aprovação Stripe Connect (charges_enabled=true) foi enviada ao motorista. Usado para idempotência — push/email só dispara uma vez.';
