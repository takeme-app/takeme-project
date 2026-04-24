-- Tabela para códigos de verificação por telefone (4 dígitos), espelhando
-- `public.email_verification_codes`. Usada por `send-phone-verification-code` e
-- `verify-phone-code` (arquitetura atual: WhatsApp ainda em stub).
create table if not exists public.phone_verification_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code char(4) not null check (char_length(code) = 4),
  purpose text not null default 'signup' check (purpose in ('signup', 'password_reset')),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  user_id uuid null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_phone_verification_codes_phone_purpose
  on public.phone_verification_codes (phone, purpose);

create index if not exists idx_phone_verification_codes_phone_expires
  on public.phone_verification_codes (phone, expires_at);

-- RLS: apenas service_role (mesmo padrão atual de email_verification_codes).
alter table public.phone_verification_codes enable row level security;

create policy "phone_verification_codes_service_role_all"
  on public.phone_verification_codes
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.phone_verification_codes is
  'Códigos de 4 dígitos para verificação de telefone (OTP via WhatsApp). Usado pelas Edge Functions com service role.';
