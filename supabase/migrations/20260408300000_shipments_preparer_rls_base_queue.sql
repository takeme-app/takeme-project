-- Preparador de encomendas (worker_profiles.subtype = shipments): ver e aceitar fila da própria base.
-- O app cliente grava status confirmed após pagamento; sem esta ampliação a RLS bloqueava o SELECT/UPDATE.

DROP POLICY IF EXISTS "drivers_can_view_shipments" ON public.shipments;
DROP POLICY IF EXISTS "drivers_can_update_shipments" ON public.shipments;

CREATE POLICY "drivers_can_view_shipments"
  ON public.shipments
  FOR SELECT
  USING (
    status = 'pending_review'
    OR driver_id = auth.uid()
    OR user_id = auth.uid()
    OR (
      driver_id IS NULL
      AND status = 'confirmed'
      AND base_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.worker_profiles wp
        WHERE wp.id = auth.uid()
          AND wp.subtype = 'shipments'
          AND wp.base_id IS NOT NULL
          AND wp.base_id = shipments.base_id
      )
    )
  );

CREATE POLICY "drivers_can_update_shipments"
  ON public.shipments
  FOR UPDATE
  USING (
    status = 'pending_review'
    OR driver_id = auth.uid()
    OR (
      status = 'confirmed'
      AND driver_id IS NULL
      AND base_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.worker_profiles wp
        WHERE wp.id = auth.uid()
          AND wp.subtype = 'shipments'
          AND wp.base_id IS NOT NULL
          AND wp.base_id = shipments.base_id
      )
    )
  );
