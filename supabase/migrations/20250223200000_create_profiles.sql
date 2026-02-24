-- Tabela de perfil do usuário (espelha e estende auth.users).
-- Preenchida automaticamente ao cadastrar via trigger em auth.users.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil do usuário (nome, telefone, avatar). Criado/atualizado ao cadastrar.';

-- Trigger: ao criar usuário no Auth, criar/atualizar o perfil com os metadados.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, updated_at)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'phone', null),
    now()
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    phone = coalesce(excluded.phone, profiles.phone),
    updated_at = now();
  return new;
end;
$$;

-- Só cria o trigger se não existir (evita erro ao reaplicar).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: usuário só acessa o próprio perfil.
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Perfis para usuários que já existiam antes desta migration (backfill).
insert into public.profiles (id, full_name, phone, updated_at)
select
  id,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'phone',
  now()
from auth.users
on conflict (id) do nothing;
