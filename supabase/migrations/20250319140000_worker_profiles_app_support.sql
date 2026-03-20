-- Suporte ao app motorista: campos extras e RLS para leitura/atualização pelo próprio usuário.

alter table public.worker_profiles
  add column if not exists preference_area text,
  add column if not exists cnh_document_back_url text;

comment on column public.worker_profiles.preference_area is 'Área/bairro de preferência (cadastro motorista).';
comment on column public.worker_profiles.cnh_document_back_url is 'URL/path CNH verso no storage.';

-- RLS: worker vê e atualiza o próprio registro
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

-- Veículos do próprio worker
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

-- Rotas do próprio worker
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
