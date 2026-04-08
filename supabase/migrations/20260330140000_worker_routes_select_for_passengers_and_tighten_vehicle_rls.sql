-- Rotas utilizadas em viagens ativas: passageiro autenticado vê preço real (worker_routes).
CREATE POLICY "authenticated_select_worker_routes_for_active_scheduled_trips"
  ON public.worker_routes
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.scheduled_trips st
      WHERE st.route_id = worker_routes.id
        AND st.status = 'active'
    )
  );

COMMENT ON POLICY "authenticated_select_worker_routes_for_active_scheduled_trips" ON public.worker_routes IS
  'Cliente lê price_per_person_cents da rota vinculada a scheduled_trips ativa.';

-- Veículo exibido ao passageiro: só aprovado e ativo (alinha ao índice único por motorista).
DROP POLICY IF EXISTS "authenticated_select_vehicles_for_active_scheduled_trips" ON public.vehicles;

CREATE POLICY "authenticated_select_vehicles_for_active_scheduled_trips"
  ON public.vehicles
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND status = 'approved'::text
    AND EXISTS (
      SELECT 1
      FROM public.scheduled_trips st
      WHERE st.driver_id = vehicles.worker_id
        AND st.status = 'active'
    )
  );

COMMENT ON POLICY "authenticated_select_vehicles_for_active_scheduled_trips" ON public.vehicles IS
  'Cliente vê modelo/placa do veículo aprovado do motorista com oferta ativa.';
