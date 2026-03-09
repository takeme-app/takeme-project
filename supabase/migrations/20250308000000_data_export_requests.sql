-- Controle de solicitações de cópia de dados (LGPD): bloqueio de 5 min entre envios.
-- A Edge Function request-data-export usa service role para ler/gravar.
create table if not exists public.data_export_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_sent_at timestamptz not null default now()
);

comment on table public.data_export_requests is 'Última vez que enviamos cópia dos dados por e-mail (bloqueio 5 min).';

alter table public.data_export_requests enable row level security;

-- Nenhuma policy para anon/authenticated: só a Edge Function (service role) acessa.
