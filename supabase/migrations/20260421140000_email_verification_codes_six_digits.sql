-- Códigos de verificação passam a ter 6 dígitos (cadastro e reset de senha).
-- Remove códigos antigos (4 dígitos) que violariam a nova constraint.
delete from public.email_verification_codes;

alter table public.email_verification_codes
  drop constraint if exists email_verification_codes_code_len;

alter table public.email_verification_codes
  add constraint email_verification_codes_code_len
  check (char_length(trim(code::text)) = 6);

comment on table public.email_verification_codes is
  'Códigos de 6 dígitos para confirmação de e-mail e redefinição de senha. Usado pelas Edge Functions.';
