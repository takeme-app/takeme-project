-- Flags de status do onboarding Stripe Connect sincronizadas via webhook `account.updated`.
-- Permite distinguir conta criada (existe `stripe_connect_account_id`) de conta efetivamente
-- habilitada para cobrar e receber transferências.

ALTER TABLE public.worker_profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_details_submitted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.worker_profiles.stripe_connect_charges_enabled IS
  'Espelha Stripe Account.charges_enabled; atualizado pelo webhook account.updated.';
COMMENT ON COLUMN public.worker_profiles.stripe_connect_payouts_enabled IS
  'Espelha Stripe Account.payouts_enabled; atualizado pelo webhook account.updated.';
COMMENT ON COLUMN public.worker_profiles.stripe_connect_details_submitted IS
  'Espelha Stripe Account.details_submitted; true após conclusão do Account Link.';
