-- Viagens ofertadas (lista "Procurando viagem"). Motorista = profile que criou a viagem.
create table if not exists public.scheduled_trips (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references auth.users (id) on delete cascade,
  title text,
  origin_address text not null,
  origin_lat double precision not null,
  origin_lng double precision not null,
  destination_address text not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  departure_at timestamptz not null,
  arrival_at timestamptz not null,
  seats_available smallint not null check (seats_available >= 0),
  bags_available smallint not null check (bags_available >= 0),
  badge text default 'Take Me',
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  status text not null default 'active' check (status in ('active', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scheduled_trips_driver_id on public.scheduled_trips (driver_id);
create index if not exists idx_scheduled_trips_departure_at on public.scheduled_trips (departure_at);
create index if not exists idx_scheduled_trips_status on public.scheduled_trips (status);

alter table public.scheduled_trips enable row level security;

-- Leitura: qualquer usuário autenticado pode listar viagens ativas
create policy "Authenticated can list active scheduled_trips"
  on public.scheduled_trips for select
  using (auth.role() = 'authenticated' and status = 'active');

-- Escrita: apenas o motorista (driver_id) pode inserir/atualizar/deletar suas viagens
create policy "Driver can manage own scheduled_trips"
  on public.scheduled_trips for all
  using (auth.uid() = driver_id)
  with check (auth.uid() = driver_id);

comment on table public.scheduled_trips is 'Viagens ofertadas por motoristas (lista Procurando viagem).';
