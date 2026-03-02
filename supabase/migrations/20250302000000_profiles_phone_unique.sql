-- Telefone único: não pode existir dois cadastros com o mesmo número.
-- Normaliza phone para apenas dígitos e adiciona constraint UNIQUE.

-- 1) Normalizar valores existentes (apenas dígitos)
update public.profiles
set phone = regexp_replace(phone, '\D', '', 'g')
where phone is not null
  and trim(phone) != ''
  and phone ~ '\D';

-- 2) Remover duplicatas: manter um por phone e zerar os outros (evita falha no unique)
with dups as (
  select id, phone,
    row_number() over (partition by phone order by updated_at desc) as rn
  from public.profiles
  where phone is not null and trim(phone) != ''
)
update public.profiles p
set phone = null, updated_at = now()
from dups
where p.id = dups.id and dups.phone is not null and dups.rn > 1;

-- 3) Índice único: só para phone não nulo e não vazio
create unique index if not exists profiles_phone_key
  on public.profiles (phone)
  where (phone is not null and trim(phone) != '');

comment on column public.profiles.phone is 'Telefone do usuário (apenas dígitos). Único por cadastro.';

-- 4) Trigger: ao criar/atualizar perfil, gravar phone só com dígitos
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  raw_phone text := coalesce(trim(new.raw_user_meta_data->>'phone'), '');
  norm_phone text := nullif(regexp_replace(raw_phone, '\D', '', 'g'), '');
begin
  insert into public.profiles (id, full_name, phone, updated_at)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    norm_phone,
    now()
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    phone = coalesce(excluded.phone, profiles.phone),
    updated_at = now();
  return new;
end;
$$;
