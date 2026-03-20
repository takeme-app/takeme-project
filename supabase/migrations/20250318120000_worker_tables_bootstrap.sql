-- Deve rodar ANTES de 20250319140000_worker_profiles_app_support (que faz ALTER).
-- create-motorista-account depende destas tabelas.

create table if not exists public.worker_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  role text not null default 'driver',
  subtype text not null,
  status text not null default 'pending',
  cpf text,
  age int,
  city text,
  experience_years int,
  bank_code text,
  bank_agency text,
  bank_account text,
  pix_key text,
  has_own_vehicle boolean not null default false,
  preference_area text,
  cnh_document_url text,
  cnh_document_back_url text,
  background_check_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid (),
  worker_id uuid not null references public.worker_profiles (id) on delete cascade,
  year int,
  model text,
  plate text,
  passenger_capacity int,
  status text not null default 'pending',
  is_active boolean not null default true,
  vehicle_document_url text,
  vehicle_photos_urls jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vehicles_worker_id on public.vehicles (worker_id);

create table if not exists public.worker_routes (
  id uuid primary key default gen_random_uuid (),
  worker_id uuid not null references public.worker_profiles (id) on delete cascade,
  origin_address text not null,
  destination_address text not null,
  price_per_person_cents int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_worker_routes_worker_id on public.worker_routes (worker_id);

comment on table public.worker_profiles is 'Motorista / worker (Take Me). id = auth user id.';

-- RLS: app autenticado atualiza o próprio registro (FinalizeRegistration)
alter table public.worker_profiles enable row level security;

drop policy if exists "worker_profiles_select_own" on public.worker_profiles;
create policy "worker_profiles_select_own"
  on public.worker_profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "worker_profiles_update_own" on public.worker_profiles;
create policy "worker_profiles_update_own"
  on public.worker_profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

alter table public.vehicles enable row level security;

drop policy if exists "vehicles_select_own" on public.vehicles;
create policy "vehicles_select_own"
  on public.vehicles for select
  to authenticated
  using (worker_id = auth.uid());

drop policy if exists "vehicles_insert_own" on public.vehicles;
create policy "vehicles_insert_own"
  on public.vehicles for insert
  to authenticated
  with check (worker_id = auth.uid());

drop policy if exists "vehicles_update_own" on public.vehicles;
create policy "vehicles_update_own"
  on public.vehicles for update
  to authenticated
  using (worker_id = auth.uid())
  with check (worker_id = auth.uid());

alter table public.worker_routes enable row level security;

drop policy if exists "worker_routes_select_own" on public.worker_routes;
create policy "worker_routes_select_own"
  on public.worker_routes for select
  to authenticated
  using (worker_id = auth.uid());

drop policy if exists "worker_routes_insert_own" on public.worker_routes;
create policy "worker_routes_insert_own"
  on public.worker_routes for insert
  to authenticated
  with check (worker_id = auth.uid());

drop policy if exists "worker_routes_update_own" on public.worker_routes;
create policy "worker_routes_update_own"
  on public.worker_routes for update
  to authenticated
  using (worker_id = auth.uid())
  with check (worker_id = auth.uid());
