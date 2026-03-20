-- FinalizeRegistrationScreen: após create-motorista-account + signIn, o app faz
-- upload em storage (driver-documents) e UPDATE em worker_profiles / vehicles.
-- Erro "new row violates row-level security" costuma ser INSERT em storage.objects
-- (política não bate com o path) ou falta de policy em worker_profiles.

insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', false)
on conflict (id) do update set public = false;

-- Path do app: "{userId}/cnh_front.jpg" — primeiro segmento = auth.uid()
-- split_part é mais previsível que storage.foldername em alguns ambientes.
drop policy if exists "Driver docs upload" on storage.objects;
create policy "Driver docs upload"
  on storage.objects for insert to authenticated
  with check (
    lower(bucket_id::text) = 'driver-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "Driver docs read" on storage.objects;
create policy "Driver docs read"
  on storage.objects for select to authenticated
  using (
    lower(bucket_id::text) = 'driver-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "Driver docs update" on storage.objects;
create policy "Driver docs update"
  on storage.objects for update to authenticated
  using (
    lower(bucket_id::text) = 'driver-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    lower(bucket_id::text) = 'driver-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "Driver docs delete" on storage.objects;
create policy "Driver docs delete"
  on storage.objects for delete to authenticated
  using (
    lower(bucket_id::text) = 'driver-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Garante que o motorista logado lê e atualiza a própria linha em worker_profiles
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
