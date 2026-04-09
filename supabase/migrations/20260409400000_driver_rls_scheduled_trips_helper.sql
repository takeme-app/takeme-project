-- Corrige visibilidade do motorista para viagens, reservas e encomendas na rota.
-- Políticas com EXISTS / IN (SELECT … FROM scheduled_trips …) reavaliam RLS na
-- subconsulta; em alguns casos isso impede o motorista de “ver” a própria linha
-- de scheduled_trips dentro da subquery e quebra leitura de bookings/shipments
-- e selects aninhados — sintoma: listas vazias no app (rotas/viagens parecem sumir).
-- As migrações de notificações não alteram scheduled_trips; este arquivo isola o reparo.
--
-- A função abaixo roda como SECURITY DEFINER (lê scheduled_trips sem RLS) e só
-- retorna true se auth.uid() for o driver_id da viagem — não expõe dados a terceiros.

CREATE OR REPLACE FUNCTION public.auth_is_driver_of_scheduled_trip(p_trip uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_trip IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.scheduled_trips st
      WHERE st.id = p_trip
        AND st.driver_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.auth_is_driver_of_scheduled_trip(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_driver_of_scheduled_trip(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_driver_of_scheduled_trip(uuid) TO service_role;

COMMENT ON FUNCTION public.auth_is_driver_of_scheduled_trip(uuid) IS
  'True se o usuário autenticado é o motorista da scheduled_trip (uso em RLS).';

-- scheduled_trips: garantir gestão pelo motorista autenticado (explícito TO authenticated).
DROP POLICY IF EXISTS "Driver can manage own scheduled_trips" ON public.scheduled_trips;

CREATE POLICY "Driver can manage own scheduled_trips"
  ON public.scheduled_trips
  FOR ALL
  TO authenticated
  USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

COMMENT ON POLICY "Driver can manage own scheduled_trips" ON public.scheduled_trips IS
  'Motorista CRUD nas próprias viagens; independente de status/is_active para leitura própria.';

-- bookings: leitura/atualização pelo motorista da viagem (sem subselect sujeito a RLS).
DROP POLICY IF EXISTS "drivers_can_view_trip_bookings" ON public.bookings;
DROP POLICY IF EXISTS "drivers_can_update_trip_bookings" ON public.bookings;
DROP POLICY IF EXISTS "driver_can_read_own_trip_bookings" ON public.bookings;

CREATE POLICY "drivers_can_view_trip_bookings"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING (public.auth_is_driver_of_scheduled_trip(scheduled_trip_id));

CREATE POLICY "drivers_can_update_trip_bookings"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (public.auth_is_driver_of_scheduled_trip(scheduled_trip_id))
  WITH CHECK (public.auth_is_driver_of_scheduled_trip(scheduled_trip_id));

COMMENT ON POLICY "drivers_can_view_trip_bookings" ON public.bookings IS
  'Motorista lê reservas das próprias viagens (complementa "Users can view own bookings").';

-- shipments: ramo “sem base + scheduled_trip” usa a mesma função.
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
      AND public.auth_is_driver_of_scheduled_trip(shipments.scheduled_trip_id)
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
      AND public.auth_is_driver_of_scheduled_trip(shipments.scheduled_trip_id)
    )
  );
