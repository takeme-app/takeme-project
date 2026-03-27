-- Permite que o motorista leia as reservas das suas próprias viagens agendadas.
CREATE POLICY "driver_can_read_own_trip_bookings"
  ON public.bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.scheduled_trips st
      WHERE st.id = bookings.scheduled_trip_id
        AND st.driver_id = auth.uid()
    )
  );
