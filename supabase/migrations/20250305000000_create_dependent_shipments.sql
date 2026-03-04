-- Envios de dependentes (fluxo Envio de dependentes em Serviços/Início).
create table if not exists public.dependent_shipments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dependent_id uuid references public.dependents (id) on delete set null,
  full_name text not null,
  contact_phone text not null,
  bags_count integer not null default 0 check (bags_count >= 0),
  instructions text,
  origin_address text not null,
  origin_lat double precision,
  origin_lng double precision,
  destination_address text not null,
  destination_lat double precision,
  destination_lng double precision,
  when_option text not null check (when_option in ('now', 'later')),
  scheduled_at timestamptz,
  payment_method text not null,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'pending_review' check (status in ('pending_review', 'confirmed', 'in_progress', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_dependent_shipments_user_id on public.dependent_shipments (user_id);
create index if not exists idx_dependent_shipments_status on public.dependent_shipments (status);
create index if not exists idx_dependent_shipments_created_at on public.dependent_shipments (created_at desc);

alter table public.dependent_shipments enable row level security;

create policy "Users can view own dependent_shipments"
  on public.dependent_shipments for select
  using (auth.uid() = user_id);

create policy "Users can insert own dependent_shipments"
  on public.dependent_shipments for insert
  with check (auth.uid() = user_id);

create policy "Users can update own dependent_shipments"
  on public.dependent_shipments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.dependent_shipments is 'Envios de dependentes; status pending_review/confirmed/in_progress/delivered/cancelled.';
