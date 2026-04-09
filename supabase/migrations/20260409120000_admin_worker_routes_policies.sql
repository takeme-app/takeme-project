-- Painel admin: listar e editar rotas de qualquer motorista (MotoristaEditScreen).
-- RLS anterior só permitia SELECT em worker_routes para o próprio worker_id ou rotas
-- referenciadas por scheduled_trips ativas — o admin via lista incompleta ou vazia.

DROP POLICY IF EXISTS "Admin can read all worker_routes" ON public.worker_routes;
CREATE POLICY "Admin can read all worker_routes"
  ON public.worker_routes FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin can insert worker_routes" ON public.worker_routes;
CREATE POLICY "Admin can insert worker_routes"
  ON public.worker_routes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can update all worker_routes" ON public.worker_routes;
CREATE POLICY "Admin can update all worker_routes"
  ON public.worker_routes FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can delete all worker_routes" ON public.worker_routes;
CREATE POLICY "Admin can delete all worker_routes"
  ON public.worker_routes FOR DELETE
  TO authenticated
  USING (public.is_admin());

COMMENT ON POLICY "Admin can read all worker_routes" ON public.worker_routes IS
  'Admin JWT (app_metadata.role=admin): ver todas as rotas cadastradas por worker_id.';
