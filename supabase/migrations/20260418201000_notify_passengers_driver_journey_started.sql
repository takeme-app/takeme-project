-- Notificações in-app para passageiros quando o motorista inicia a viagem (driver_journey_started_at).

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
    b.user_id,
    'Motorista a caminho',
    format(
      'O motorista iniciou a viagem rumo a %s. Acompanhe no app.',
      dest_preview
    ),
    'travel_updates'
  FROM public.bookings b
  WHERE b.scheduled_trip_id = NEW.id
    AND b.status = 'confirmed';

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_passengers_driver_journey_started() IS
  'Ao definir driver_journey_started_at (primeira vez), notifica cada passageiro com reserva confirmada.';

DROP TRIGGER IF EXISTS trg_notify_passengers_driver_journey_started ON public.scheduled_trips;
CREATE TRIGGER trg_notify_passengers_driver_journey_started
  AFTER UPDATE OF driver_journey_started_at, status ON public.scheduled_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_passengers_driver_journey_started();
