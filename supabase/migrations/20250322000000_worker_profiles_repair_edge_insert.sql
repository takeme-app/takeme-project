-- Repara worker_profiles para o INSERT da edge create-motorista-account.
-- Sintoma: usuário em auth.users + profiles, mas sem linha em worker_profiles.

-- Diagnóstico (rode antes, se quiser):
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'worker_profiles'
-- order by ordinal_position;

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

-- Tabela antiga / incompleta: acrescenta o que a edge envia e pode faltar
alter table public.worker_profiles add column if not exists role text;
alter table public.worker_profiles add column if not exists subtype text;
alter table public.worker_profiles add column if not exists status text;
alter table public.worker_profiles add column if not exists cpf text;
alter table public.worker_profiles add column if not exists age int;
alter table public.worker_profiles add column if not exists city text;
alter table public.worker_profiles add column if not exists experience_years int;
alter table public.worker_profiles add column if not exists bank_code text;
alter table public.worker_profiles add column if not exists bank_agency text;
alter table public.worker_profiles add column if not exists bank_account text;
alter table public.worker_profiles add column if not exists pix_key text;
alter table public.worker_profiles add column if not exists has_own_vehicle boolean;
alter table public.worker_profiles add column if not exists preference_area text;
alter table public.worker_profiles add column if not exists cnh_document_url text;
alter table public.worker_profiles add column if not exists cnh_document_back_url text;
alter table public.worker_profiles add column if not exists background_check_url text;
alter table public.worker_profiles add column if not exists created_at timestamptz;
alter table public.worker_profiles add column if not exists updated_at timestamptz;

-- Defaults para linhas antigas / colunas novas
alter table public.worker_profiles alter column role set default 'driver';
alter table public.worker_profiles alter column status set default 'pending';
alter table public.worker_profiles alter column has_own_vehicle set default false;

alter table public.worker_profiles alter column created_at set default now();
alter table public.worker_profiles alter column updated_at set default now();

-- Não dropar worker_profiles_subtype_check: produção usa takeme|partner|shipments|excursions; a edge mapeia take_me/parceiro.

-- Se worker_profiles.id não for FK para profiles(id), ajuste no SQL Editor:
-- alter table public.worker_profiles
--   add constraint worker_profiles_id_fkey
--   foreign key (id) references public.profiles (id) on delete cascade;

comment on table public.worker_profiles is 'Motorista; id = auth user = profiles.id. Preenchida pela edge create-motorista-account.';
