-- Cobrança Stripe (charge-shipment) + estorno (process-refund) + auditoria.

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.shipments.stripe_payment_intent_id IS 'PaymentIntent Stripe (pi_…) após charge-shipment.';

ALTER TABLE public.dependent_shipments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.dependent_shipments.stripe_payment_intent_id IS 'PaymentIntent Stripe após charge-shipment.';

-- Excursões: alinhar com process-refund (opcional até haver cobrança no fluxo).
ALTER TABLE public.excursion_requests
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.excursion_requests.stripe_payment_intent_id IS 'PaymentIntent quando houver cobrança Stripe no orçamento aceito.';
