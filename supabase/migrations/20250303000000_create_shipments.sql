-- Envios (shipments) na guia Serviços.
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  origin_address text not null,
  origin_lat double precision,
  origin_lng double precision,
  destination_address text not null,
  destination_lat double precision,
  destination_lng double precision,
  when_option text not null check (when_option in ('now', 'later')),
  scheduled_at timestamptz,
  package_size text not null check (package_size in ('pequeno', 'medio', 'grande')),
  recipient_name text not null,
  recipient_email text not null,
  recipient_phone text not null,
  instructions text,
  photo_url text,
  payment_method text not null,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'pending_review' check (status in ('pending_review', 'confirmed', 'in_progress', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_shipments_user_id on public.shipments (user_id);
create index if not exists idx_shipments_status on public.shipments (status);
create index if not exists idx_shipments_created_at on public.shipments (created_at desc);

alter table public.shipments enable row level security;

create policy "Users can view own shipments"
  on public.shipments for select
  using (auth.uid() = user_id);

create policy "Users can insert own shipments"
  on public.shipments for insert
  with check (auth.uid() = user_id);

comment on table public.shipments is 'Envios na guia Serviços; status pending_review/confirmed/in_progress/delivered/cancelled.';
