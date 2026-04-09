-- Cronograma de rotas: passageiros só veem ofertas com status operacional ativo E switch ligado (is_active).
-- Viagens de rota eram gravadas com status 'scheduled', invisíveis à RLS e ao filtro do app cliente (active).

UPDATE public.scheduled_trips
SET status = 'active'
WHERE route_id IS NOT NULL
  AND status = 'scheduled';

DROP POLICY IF EXISTS "Authenticated can list active scheduled_trips" ON public.scheduled_trips;

CREATE POLICY "Authenticated can list active scheduled_trips"
  ON public.scheduled_trips FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND status = 'active'
    AND is_active = true
  );

-- Detalhe da viagem / checkout após reserva: passageiro continua lendo a linha mesmo com oferta desligada.
CREATE POLICY "Passengers select scheduled_trips for own bookings"
  ON public.scheduled_trips FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.scheduled_trip_id = scheduled_trips.id
        AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "authenticated_select_worker_routes_for_active_scheduled_trips" ON public.worker_routes;

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
        AND st.is_active = true
    )
  );

COMMENT ON POLICY "authenticated_select_worker_routes_for_active_scheduled_trips" ON public.worker_routes IS
  'Cliente lê preço da rota vinculada a scheduled_trips ativa e com oferta ligada (is_active).';

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
        AND st.is_active = true
    )
  );

COMMENT ON POLICY "authenticated_select_vehicles_for_active_scheduled_trips" ON public.vehicles IS
  'Cliente vê veículo do motorista com pelo menos uma oferta ativa e ligada (is_active).';
