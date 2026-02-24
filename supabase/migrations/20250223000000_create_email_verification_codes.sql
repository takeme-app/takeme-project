-- Tabela para códigos de verificação de e-mail (4 dígitos)
create table if not exists public.email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code char(4) not null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);

-- Índice para buscar por email e código válido
create index if not exists idx_email_verification_codes_email_expires
  on public.email_verification_codes (email, expires_at);

-- RLS: apenas o service role pode ler/escrever (Edge Functions usam service role)
alter table public.email_verification_codes enable row level security;

create policy "Service role only"
  on public.email_verification_codes
  for all
  using (false)
  with check (false);

comment on table public.email_verification_codes is 'Códigos de 4 dígitos para confirmação de e-mail no cadastro. Usado pelas Edge Functions.';
