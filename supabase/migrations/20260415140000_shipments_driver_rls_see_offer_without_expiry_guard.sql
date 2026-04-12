-- A política de SELECT exigia current_offer_expires_at > now().
-- Após expirar, o motorista alvo deixava de ver a linha (array vazio no app) até o cron/RPC
-- reprocessar — e a UI nem mostrava "expirado". Alinhar ao UPDATE, que já não usa o relógio na RLS.

DROP POLICY IF EXISTS "drivers_can_view_shipments" ON public.shipments;

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
      AND public.worker_is_shipments_preparer_for_base(shipments.base_id)
    )
    OR (
      shipments.base_id IS NULL
      AND shipments.scheduled_trip_id IS NOT NULL
      AND shipments.driver_id IS NULL
      AND shipments.status IN ('pending_review', 'confirmed')
      AND EXISTS (
        SELECT 1
        FROM public.scheduled_trips st
        WHERE st.id = shipments.scheduled_trip_id
          AND st.driver_id = auth.uid()
      )
    )
    OR (
      shipments.driver_id IS NULL
      AND shipments.status = 'confirmed'
      AND shipments.current_offer_driver_id = auth.uid()
    )
  );
