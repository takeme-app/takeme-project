-- Fase 7 RLS: worker_assignments
-- IMPORTANTE: criar policies ANTES de habilitar RLS para nao quebrar motorista
-- (PendingRequestsScreen depende de SELECT/UPDATE por worker_id = auth.uid()).
--
-- Admin UI nao consulta worker_assignments diretamente (apps/admin), mas
-- mantemos policies para admins por garantia futura. Edge Functions
-- (expire-assignments, respond-assignment deprecated) usam service_role e
-- bypassam RLS.

DROP POLICY IF EXISTS "worker_assignments_worker_read_own" ON public.worker_assignments;
CREATE POLICY "worker_assignments_worker_read_own"
  ON public.worker_assignments FOR SELECT TO authenticated
  USING (worker_id = auth.uid());

DROP POLICY IF EXISTS "worker_assignments_worker_update_own" ON public.worker_assignments;
CREATE POLICY "worker_assignments_worker_update_own"
  ON public.worker_assignments FOR UPDATE TO authenticated
  USING (worker_id = auth.uid())
  WITH CHECK (worker_id = auth.uid());

DROP POLICY IF EXISTS "worker_assignments_admin_read" ON public.worker_assignments;
CREATE POLICY "worker_assignments_admin_read"
  ON public.worker_assignments FOR SELECT TO authenticated
  USING (is_admin_v2());

DROP POLICY IF EXISTS "worker_assignments_admin_update" ON public.worker_assignments;
CREATE POLICY "worker_assignments_admin_update"
  ON public.worker_assignments FOR UPDATE TO authenticated
  USING (is_admin_v2())
  WITH CHECK (is_admin_v2());

ALTER TABLE public.worker_assignments ENABLE ROW LEVEL SECURITY;
