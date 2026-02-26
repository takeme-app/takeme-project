-- Reservas de viagem (booking) feitas pelo passageiro.
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

-- Usuário vê e cria apenas suas próprias reservas
create policy "Users can view own bookings"
  on public.bookings for select
  using (auth.uid() = user_id);

create policy "Users can insert own bookings"
  on public.bookings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own bookings"
  on public.bookings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.bookings is 'Reservas de viagem; status pending/confirmed/paid/cancelled.';
comment on column public.bookings.passenger_data is 'Array de { name, cpf, bags } por passageiro.';
