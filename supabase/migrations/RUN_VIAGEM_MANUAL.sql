-- Execute este arquivo no Supabase Dashboard → SQL Editor se as tabelas de viagem ainda não existirem.
-- Ordem: scheduled_trips → bookings → recent_destinations → seed.

-- 1. Tabela scheduled_trips
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
drop policy if exists "Authenticated can list active scheduled_trips" on public.scheduled_trips;
create policy "Authenticated can list active scheduled_trips" on public.scheduled_trips for select
  using (auth.role() = 'authenticated' and status = 'active');
drop policy if exists "Driver can manage own scheduled_trips" on public.scheduled_trips;
create policy "Driver can manage own scheduled_trips" on public.scheduled_trips for all
  using (auth.uid() = driver_id) with check (auth.uid() = driver_id);

-- 2. Tabela bookings
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scheduled_trip_id uuid not null references public.scheduled_trips (id) on delete restrict,
  origin_address text not null,
  origin_lat double precision not null,
  origin_lng double precision not null,
  destination_address text not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  passenger_count smallint not null check (passenger_count >= 1),
  bags_count smallint not null check (bags_count >= 0),
  passenger_data jsonb not null default '[]',
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'paid', 'cancelled')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_bookings_user_id on public.bookings (user_id);
create index if not exists idx_bookings_scheduled_trip_id on public.bookings (scheduled_trip_id);
create index if not exists idx_bookings_status on public.bookings (status);
alter table public.bookings enable row level security;
drop policy if exists "Users can view own bookings" on public.bookings;
create policy "Users can view own bookings" on public.bookings for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own bookings" on public.bookings;
create policy "Users can insert own bookings" on public.bookings for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own bookings" on public.bookings;
create policy "Users can update own bookings" on public.bookings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Tabela recent_destinations
create table if not exists public.recent_destinations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  address text not null,
  city text not null,
  latitude double precision,
  longitude double precision,
  used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_recent_destinations_user_id on public.recent_destinations (user_id);
create index if not exists idx_recent_destinations_used_at on public.recent_destinations (user_id, used_at desc);
alter table public.recent_destinations enable row level security;
drop policy if exists "Users can view own recent_destinations" on public.recent_destinations;
create policy "Users can view own recent_destinations" on public.recent_destinations for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own recent_destinations" on public.recent_destinations;
create policy "Users can insert own recent_destinations" on public.recent_destinations for insert with check (auth.uid() = user_id);
drop policy if exists "Users can delete own recent_destinations" on public.recent_destinations;
create policy "Users can delete own recent_destinations" on public.recent_destinations for delete using (auth.uid() = user_id);

-- 4. Seed: 2 viagens de teste (origem centro Itabaiana, PB → destino João Pessoa, PB)
insert into public.scheduled_trips (
  driver_id, title, origin_address, origin_lat, origin_lng,
  destination_address, destination_lat, destination_lng,
  departure_at, arrival_at, seats_available, bags_available, badge, amount_cents, status
)
select p.id, 'Itabaiana → João Pessoa', 'Rua Padre Calado, Centro, Itabaiana, PB', -7.3289, -35.3328,
  'Centro, João Pessoa, PB', -7.1195, -34.8450,
  date_trunc('day', now()) + time '14:00', date_trunc('day', now()) + time '16:30',
  3, 2, 'Take Me', 6400, 'active'
from public.profiles p limit 1;

insert into public.scheduled_trips (
  driver_id, title, origin_address, origin_lat, origin_lng,
  destination_address, destination_lat, destination_lng,
  departure_at, arrival_at, seats_available, bags_available, badge, amount_cents, status
)
select p.id, 'Itabaiana → João Pessoa', 'Praça Getúlio Vargas, Centro, Itabaiana, PB', -7.3289, -35.3328,
  'Av. Epitácio Pessoa, João Pessoa, PB', -7.1195, -34.8450,
  date_trunc('day', now()) + time '14:05', date_trunc('day', now()) + time '16:35',
  2, 1, 'Parceiro', 5500, 'active'
from public.profiles p limit 1;
