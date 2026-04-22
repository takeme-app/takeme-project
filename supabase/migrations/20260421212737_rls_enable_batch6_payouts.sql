-- Fase 6 RLS: payouts
-- Remove a policy "Authenticated admin can read all payouts" (leaky: qualquer
-- authenticated lia todos os payouts) e adiciona self-read para motorista.
-- Admin leitura/update continuam cobertos pelas policies existentes baseadas
-- em is_admin_v2(). INSERT/DELETE sem policy => RLS nega por padrão; Edge
-- Functions (process-payouts, process-refund, refund-journey-start-not-accepted)
-- usam service_role e bypassam RLS.

DROP POLICY IF EXISTS "Authenticated admin can read all payouts" ON public.payouts;

DROP POLICY IF EXISTS "payouts_worker_read_own" ON public.payouts;
CREATE POLICY "payouts_worker_read_own"
  ON public.payouts FOR SELECT TO authenticated
  USING (worker_id = auth.uid());

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
