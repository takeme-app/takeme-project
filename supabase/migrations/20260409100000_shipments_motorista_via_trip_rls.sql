-- Encomendas sem base (base_id IS NULL) vinculadas a scheduled_trips: o motorista da viagem
-- pode ver e aceitar/recusar antes de driver_id ser preenchido.

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS scheduled_trip_id uuid REFERENCES public.scheduled_trips (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_scheduled_trip_id
  ON public.shipments (scheduled_trip_id)
  WHERE scheduled_trip_id IS NOT NULL;

COMMENT ON COLUMN public.shipments.scheduled_trip_id IS
  'Viagem agendada quando o envio é entregue pelo motorista da rota (sem base).';

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
  );
