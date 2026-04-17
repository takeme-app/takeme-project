-- A política antiga "Service role only" usava USING (false) para todos os papéis.
-- Em ambientes em que o JWT service_role não bypassa RLS no PostgREST, o insert da edge falhava.
-- Anon/authenticated continuam sem política permissiva → acesso negado por padrão com RLS ativo.

drop policy if exists "Service role only" on public.email_verification_codes;

create policy "email_verification_codes_service_role_all"
  on public.email_verification_codes
  for all
  to service_role
  using (true)
  with check (true);
