-- Conta conectada Stripe Connect (Standard/Express) para repasse automático na cobrança.
-- Preenchido após onboarding (Account Link / Dashboard) ou por integração admin.

ALTER TABLE public.worker_profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text NULL;

COMMENT ON COLUMN public.worker_profiles.stripe_connect_account_id IS
  'Stripe Connect account id (acct_…). Usado em PaymentIntent com transfer_data.destination + application_fee_amount.';

CREATE INDEX IF NOT EXISTS idx_worker_profiles_stripe_connect_account_id
  ON public.worker_profiles (stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;
