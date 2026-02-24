-- Estrutura pronta para métodos de pagamento (cartões).
-- Provedor de pagamento ainda não definido; quando for escolhido, tokenizar no provedor
-- e salvar aqui apenas: provider, provider_id e metadados. NUNCA número completo nem CVV.
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('credit', 'debit')),
  last_four char(4),
  brand text,
  expiry_month smallint check (expiry_month between 1 and 12),
  expiry_year smallint,
  holder_name text,
  -- Nome do provedor quando for integrado (ex: 'stripe', 'mercadopago')
  provider text,
  -- Id/token retornado pelo provedor após tokenizar o cartão
  provider_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_methods_user_id
  on public.payment_methods (user_id);

alter table public.payment_methods enable row level security;

-- Usuário só vê e gerencia os próprios métodos de pagamento
create policy "Users can manage own payment methods"
  on public.payment_methods
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.payment_methods is 'Estrutura pronta para métodos de pagamento. Integração com provedor (tokenização) a definir.';
