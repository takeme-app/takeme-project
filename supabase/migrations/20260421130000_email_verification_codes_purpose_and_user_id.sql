-- Códigos distintos para cadastro (signup) vs redefinição de senha (password_reset).
-- user_id preenchido em linhas de password_reset para emitir token sem novo listUsers.

alter table public.email_verification_codes
  add column if not exists purpose text not null default 'signup';

alter table public.email_verification_codes
  drop constraint if exists email_verification_codes_purpose_check;

alter table public.email_verification_codes
  add constraint email_verification_codes_purpose_check
  check (purpose = any (array['signup'::text, 'password_reset'::text]));

-- auth.users(id); sem FK para evitar ordem de migração entre schemas.
alter table public.email_verification_codes
  add column if not exists user_id uuid;

create index if not exists idx_email_verification_codes_email_purpose_expires
  on public.email_verification_codes (email, purpose, expires_at);

comment on column public.email_verification_codes.purpose is 'signup = cadastro; password_reset = recuperação de senha.';
comment on column public.email_verification_codes.user_id is 'Preenchido em password_reset; opcional em signup.';
