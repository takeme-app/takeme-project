-- ID do cliente Stripe para tokenização de cartões (attach PaymentMethod ao Customer).
alter table public.profiles
  add column if not exists stripe_customer_id text;

comment on column public.profiles.stripe_customer_id is 'Stripe Customer ID (cus_xxx) para métodos de pagamento.';
