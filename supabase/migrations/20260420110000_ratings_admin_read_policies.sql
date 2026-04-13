-- Permitir admin ler todas as avaliações.
CREATE POLICY trip_ratings_admin_read ON public.trip_ratings
  FOR SELECT USING (public.is_admin());

CREATE POLICY worker_ratings_admin_read ON public.worker_ratings
  FOR SELECT USING (public.is_admin());

CREATE POLICY booking_ratings_admin_read ON public.booking_ratings
  FOR SELECT USING (public.is_admin());

CREATE POLICY shipment_ratings_admin_read ON public.shipment_ratings
  FOR SELECT USING (public.is_admin());

CREATE POLICY dependent_shipment_ratings_admin_read ON public.dependent_shipment_ratings
  FOR SELECT USING (public.is_admin());
