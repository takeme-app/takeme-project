-- INSERT em public.notifications pelos triggers de 20260409200000 (e análogos).
-- A tabela só tinha policies de SELECT/UPDATE para o próprio usuário; o INSERT dos
-- triggers depende do papel dono da função SECURITY DEFINER bypassar RLS. Em alguns
-- ambientes isso não ocorre e o INSERT falha — revertendo booking/shipment inteiro.
--
-- Esta policy restringe INSERT a papéis de sistema (não authenticated), mantendo
-- o cliente impossibilitado de forjar notificações para terceiros.

DROP POLICY IF EXISTS "system_roles_insert_notifications" ON public.notifications;

CREATE POLICY "system_roles_insert_notifications"
  ON public.notifications
  FOR INSERT
  TO postgres, service_role
  WITH CHECK (true);

COMMENT ON POLICY "system_roles_insert_notifications" ON public.notifications IS
  'Triggers SECURITY DEFINER (ex.: notify_driver_new_booking_request, notify_driver_shipment_on_trip, dependentes).';

DO $body$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    EXECUTE 'DROP POLICY IF EXISTS "supabase_admin_insert_notifications" ON public.notifications';
    EXECUTE $p$
      CREATE POLICY "supabase_admin_insert_notifications"
        ON public.notifications
        FOR INSERT
        TO supabase_admin
        WITH CHECK (true)
    $p$;
  END IF;
END
$body$;
