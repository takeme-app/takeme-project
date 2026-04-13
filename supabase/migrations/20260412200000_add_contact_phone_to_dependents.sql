-- Adiciona telefone de contato ao cadastro de dependentes.
alter table public.dependents
  add column if not exists contact_phone text;

comment on column public.dependents.contact_phone is 'Telefone de contato do dependente (somente dígitos, com DDD).';
