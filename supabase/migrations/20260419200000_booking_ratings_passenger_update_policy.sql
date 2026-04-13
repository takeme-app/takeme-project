-- Permite ao passageiro atualizar a própria avaliação (upsert PostgREST / reenvio).

DROP POLICY IF EXISTS "Users can update rating for own booking" ON public.booking_ratings;
CREATE POLICY "Users can update rating for own booking"
  ON public.booking_ratings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.user_id = auth.uid()
    )
  );
