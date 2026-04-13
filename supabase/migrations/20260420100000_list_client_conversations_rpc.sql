-- Lista de conversas no app cliente: RPC estável que não depende só do PostgREST + RLS em conjuntos .or().

CREATE OR REPLACE FUNCTION public.list_client_conversations_for_app()
RETURNS SETOF public.conversations
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT c.*
  FROM public.conversations c
  WHERE c.client_id = auth.uid()
     OR c.driver_id = auth.uid()
     OR c.support_requester_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.list_client_conversations_for_app() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_client_conversations_for_app() TO authenticated;

COMMENT ON FUNCTION public.list_client_conversations_for_app() IS
  'Conversas em que o utilizador autenticado participa (client_id, driver_id ou support_requester_id). App cliente — ecrã Conversas.';
