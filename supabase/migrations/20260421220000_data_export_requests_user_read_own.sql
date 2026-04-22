-- Policy para o usuario ler o proprio registro de data_export_requests.
-- Satisfaz o advisor rls_enabled_no_policy (tabela tinha RLS on, sem policies).
-- A Edge Function request-data-export continua usando service_role e bypassando RLS.

DROP POLICY IF EXISTS "data_export_requests_user_read_own" ON public.data_export_requests;
CREATE POLICY "data_export_requests_user_read_own"
  ON public.data_export_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());
