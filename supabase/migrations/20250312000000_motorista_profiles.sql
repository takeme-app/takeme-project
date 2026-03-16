-- Cadastro de motoristas: perfil estendido e documentos.
-- 1:1 com profiles (profile_id = auth.users.id após criar conta).

create table if not exists public.motorista_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade unique,
  driver_type text not null check (driver_type in ('take_me', 'parceiro')),

  -- Dados básicos
  full_name text,
  cpf text,
  age int,
  city text,
  years_of_experience int,

  -- Dados bancários
  bank_code text,
  agency_number text,
  account_number text,
  pix_key text,

  -- Documentos (paths no bucket driver-documents)
  cnh_front_url text,
  cnh_back_url text,
  criminal_record_url text,

  -- Veículo
  vehicle_type text check (vehicle_type is null or vehicle_type in ('carro', 'moto')),
  vehicle_year int,
  vehicle_model text,
  vehicle_chassis text,
  vehicle_document_url text,
  vehicle_photos_urls jsonb default '[]'::jsonb,

  -- Valores (encomendas)
  delivery_value numeric(10,2),
  km_value numeric(10,2),

  -- Aceites
  accepted_terms boolean not null default false,
  accepted_notifications boolean not null default false,

  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_motorista_profiles_profile_id on public.motorista_profiles(profile_id);
create index if not exists idx_motorista_profiles_status on public.motorista_profiles(status);

comment on table public.motorista_profiles is 'Cadastro estendido de motoristas (Take Me ou Parceiro).';
comment on column public.motorista_profiles.driver_type is 'take_me = vinculado à Take Me; parceiro = frota/empresa parceira.';
comment on column public.motorista_profiles.vehicle_photos_urls is 'Array de URLs de fotos do veículo no storage.';
comment on column public.motorista_profiles.status is 'pending = aguardando análise; verified = aprovado; rejected = rejeitado.';

create or replace function public.set_motorista_profiles_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists motorista_profiles_updated_at on public.motorista_profiles;
create trigger motorista_profiles_updated_at
  before update on public.motorista_profiles
  for each row execute function public.set_motorista_profiles_updated_at();

alter table public.motorista_profiles enable row level security;

create policy "Motorista profiles select own"
  on public.motorista_profiles for select to authenticated
  using (profile_id = auth.uid());

create policy "Motorista profiles insert own"
  on public.motorista_profiles for insert to authenticated
  with check (profile_id = auth.uid());

create policy "Motorista profiles update own"
  on public.motorista_profiles for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Bucket para documentos do motorista (CNH, antecedentes, doc veículo, fotos)
insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Driver docs upload" on storage.objects;
create policy "Driver docs upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'driver-documents' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Driver docs read" on storage.objects;
create policy "Driver docs read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'driver-documents' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Driver docs update" on storage.objects;
create policy "Driver docs update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'driver-documents' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Driver docs delete" on storage.objects;
create policy "Driver docs delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'driver-documents' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
