-- trip_ratings: INSERT com EXISTS em scheduled_trips pode falhar sob RLS aninhada
-- (motorista não “vê” a linha na subconsulta após status completed, etc.).
-- Reutiliza auth_is_driver_of_scheduled_trip (SECURITY DEFINER) como nas políticas de bookings.

DROP POLICY IF EXISTS "Drivers insert own trip ratings" ON public.trip_ratings;

CREATE POLICY "Drivers insert own trip ratings"
  ON public.trip_ratings FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = auth.uid()
    AND public.auth_is_driver_of_scheduled_trip(trip_id)
  );

COMMENT ON POLICY "Drivers insert own trip ratings" ON public.trip_ratings IS
  'Motorista insere avaliação só da própria viagem (checagem via função definer, sem RLS aninhada).';
