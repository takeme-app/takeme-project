-- char(4) / character(4) preenche com espaços; PostgREST .eq('code', '1234') muitas vezes não casa.
alter table public.email_verification_codes
  alter column code type text using trim(both from code::text);

alter table public.email_verification_codes
  drop constraint if exists email_verification_codes_code_len;

alter table public.email_verification_codes
  add constraint email_verification_codes_code_len check (char_length(code) = 4);

comment on column public.email_verification_codes.code is 'Quatro dígitos (text), sem padding de char(n).';
