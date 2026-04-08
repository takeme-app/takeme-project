-- Passageiros autenticados podem ver dados do veículo de motoristas que têm
-- pelo menos uma scheduled_trips ativa (busca de viagem e acompanhamento).
CREATE POLICY "authenticated_select_vehicles_for_active_scheduled_trips"
  ON public.vehicles
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.scheduled_trips st
      WHERE st.driver_id = vehicles.worker_id
        AND st.status = 'active'
    )
  );

COMMENT ON POLICY "authenticated_select_vehicles_for_active_scheduled_trips" ON public.vehicles IS
  'Cliente vê modelo/placa ao escolher viagem com motorista que tem oferta ativa.';
