-- Ambientes em que a tabela parou no schema inicial (sem purpose/user_id, code ainda char):
-- alinha com as Edge Functions send-email-verification-code / verify-email-code.
-- Idempotente: pode rodar mais de uma vez.

delete from public.email_verification_codes;

alter table public.email_verification_codes
  drop constraint if exists email_verification_codes_code_len;

alter table public.email_verification_codes
  alter column code type text using trim(both from code::text);

alter table public.email_verification_codes
  add column if not exists purpose text not null default 'signup';

alter table public.email_verification_codes
  drop constraint if exists email_verification_codes_purpose_check;

alter table public.email_verification_codes
  add constraint email_verification_codes_purpose_check
  check (purpose = any (array['signup'::text, 'password_reset'::text]));

alter table public.email_verification_codes
  add column if not exists user_id uuid;

alter table public.email_verification_codes
  add constraint email_verification_codes_code_len
  check (char_length(trim(code::text)) = 4);

create index if not exists idx_email_verification_codes_email_purpose_expires
  on public.email_verification_codes (email, purpose, expires_at);

comment on table public.email_verification_codes is
  'Códigos de 4 dígitos para confirmação de e-mail e redefinição de senha. Usado pelas Edge Functions.';
comment on column public.email_verification_codes.purpose is 'signup = cadastro; password_reset = recuperação de senha.';
comment on column public.email_verification_codes.user_id is 'Preenchido em password_reset; opcional em signup.';

-- RLS: libera gravação explícita para service_role (evita insert bloqueado).
drop policy if exists "Service role only" on public.email_verification_codes;
drop policy if exists "email_verification_codes_service_role_all" on public.email_verification_codes;

create policy "email_verification_codes_service_role_all"
  on public.email_verification_codes
  for all
  to service_role
  using (true)
  with check (true);
