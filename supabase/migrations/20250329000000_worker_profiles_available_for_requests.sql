-- Toggle "Disponível" na home do app motorista.
alter table public.worker_profiles add column if not exists is_available_for_requests boolean not null default false;

comment on column public.worker_profiles.is_available_for_requests is
  'Se o motorista está disponível para receber solicitações (UI home).';
