-- Motorista pode excluir (hard delete) a própria rota após desativar ofertas no app.
-- O app desativa `scheduled_trips` antes de apagar a linha em `worker_routes`.

DROP POLICY IF EXISTS "worker_routes_delete_own" ON public.worker_routes;

CREATE POLICY "worker_routes_delete_own"
  ON public.worker_routes
  FOR DELETE
  TO authenticated
  USING (worker_id = auth.uid());

COMMENT ON POLICY "worker_routes_delete_own" ON public.worker_routes IS
  'Motorista remove rotas próprias (uso em Minhas rotas → excluir).';
