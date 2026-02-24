-- Estende profiles com campos da guia de perfil (CPF, localidade, rating, verified).
alter table public.profiles
  add column if not exists cpf text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists rating numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  add column if not exists verified boolean not null default false;

comment on column public.profiles.cpf is 'CPF do usuário (apenas para exibição/validação no app).';
comment on column public.profiles.city is 'Cidade (localidade).';
comment on column public.profiles.state is 'Estado (UF).';
comment on column public.profiles.rating is 'Nota média exibida no perfil (0-5).';
comment on column public.profiles.verified is 'Indica se a conta está verificada (badge Verificado).';
