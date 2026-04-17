-- Volta códigos de e-mail (cadastro / reset) para 4 dígitos.
delete from public.email_verification_codes;

alter table public.email_verification_codes
  drop constraint if exists email_verification_codes_code_len;

alter table public.email_verification_codes
  add constraint email_verification_codes_code_len
  check (char_length(trim(code::text)) = 4);

comment on table public.email_verification_codes is
  'Códigos de 4 dígitos para confirmação de e-mail e redefinição de senha. Usado pelas Edge Functions.';
