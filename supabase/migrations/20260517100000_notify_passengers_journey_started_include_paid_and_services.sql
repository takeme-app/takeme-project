-- Ao iniciar a viagem (driver_journey_started_at), notificar clientes na tabela
-- public.notifications (webhook → dispatch-notification-fcm para app cliente).
--
-- Correções:
-- 1) bookings após cobrança ficam em status 'paid' (charge-booking); o trigger
--    anterior só incluía 'confirmed', então o push/in-app não disparava.
-- 2) envios (shipments) e envios de dependentes (dependent_shipments) ligados à
--    mesma scheduled_trip também devem ser notificados.

CREATE OR REPLACE FUNCTION public.notify_passengers_driver_journey_started()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dest_preview text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.driver_journey_started_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.driver_journey_started_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  dest_preview := left(coalesce(NEW.destination_address, 'destino'), 100);

  INSERT INTO public.notifications (user_id, title, message, category)
  SELECT DISTINCT
    u.uid,
    'Motorista a caminho',
    format(
      'O motorista iniciou a viagem rumo a %s. Acompanhe no app.',
      dest_preview
    ),
    'travel_updates'
  FROM (
    SELECT b.user_id AS uid
    FROM public.bookings b
    WHERE b.scheduled_trip_id = NEW.id
      AND b.status IN ('paid', 'confirmed')
    UNION
    SELECT ds.user_id
    FROM public.dependent_shipments ds
    WHERE ds.scheduled_trip_id = NEW.id
      AND ds.status IN ('confirmed', 'in_progress')
    UNION
    SELECT s.user_id
    FROM public.shipments s
    WHERE s.scheduled_trip_id = NEW.id
      AND s.status IN ('confirmed', 'in_progress')
  ) u;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_passengers_driver_journey_started() IS
  'Ao definir driver_journey_started_at (primeira vez), notifica clientes com reserva paga/confirmada, envio de dependente ou encomenda na mesma viagem (INSERT em notifications → FCM).';
