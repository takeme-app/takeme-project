-- Motorista escolhido como preferido precisa conseguir ler o envio **antes** da fila
-- sequencial abrir (`current_offer_driver_id` ainda nulo), para a lista no app não
-- depender só de `scheduled_trip_id` + ser driver da viagem (caso comum: confirmed
-- após pagamento, preferido setado, fila ainda não iniciada).

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
    OR (
      shipments.driver_id IS NULL
      AND shipments.base_id IS NULL
      AND shipments.status = 'confirmed'
      AND shipments.client_preferred_driver_id = auth.uid()
      AND shipments.current_offer_driver_id IS NULL
    )
  );
