-- Notificações in-app para o motorista: nova reserva na viagem e encomenda vinculada à viagem.
-- Insere em public.notifications (mesma tabela do cliente; RLS só permite SELECT/UPDATE pelo dono).

CREATE OR REPLACE FUNCTION public.notify_driver_new_booking_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  drv uuid;
  daddr text;
BEGIN
  IF NEW.status IS NULL OR NEW.status NOT IN ('pending', 'paid') THEN
    RETURN NEW;
  END IF;

  SELECT st.driver_id, st.destination_address
  INTO drv, daddr
  FROM public.scheduled_trips st
  WHERE st.id = NEW.scheduled_trip_id;

  IF drv IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, category)
  VALUES (
    drv,
    'Nova solicitação de reserva',
    format(
      'Passageiro pediu vaga: %s → %s. Abra Solicitações pendentes para aceitar ou recusar.',
      left(coalesce(NEW.origin_address, 'origem'), 80),
      left(coalesce(NEW.destination_address, daddr, 'destino'), 80)
    ),
    'travel_updates'
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_driver_new_booking_request() IS
  'Após INSERT em bookings (pending/paid), notifica o motorista da scheduled_trip.';

DROP TRIGGER IF EXISTS on_booking_insert_notify_driver ON public.bookings;
CREATE TRIGGER on_booking_insert_notify_driver
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_new_booking_request();


CREATE OR REPLACE FUNCTION public.notify_driver_shipment_on_trip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  drv uuid;
  became_linked boolean;
BEGIN
  IF NEW.scheduled_trip_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.base_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NULL OR NEW.status NOT IN ('pending_review', 'confirmed') THEN
    RETURN NEW;
  END IF;

  IF NEW.driver_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  became_linked :=
    TG_OP = 'INSERT'
    OR (TG_OP = 'UPDATE' AND (OLD.scheduled_trip_id IS DISTINCT FROM NEW.scheduled_trip_id));

  IF NOT became_linked THEN
    RETURN NEW;
  END IF;

  SELECT st.driver_id INTO drv
  FROM public.scheduled_trips st
  WHERE st.id = NEW.scheduled_trip_id;

  IF drv IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, category)
  VALUES (
    drv,
    'Nova encomenda na sua viagem',
    'Um cliente adicionou um envio à sua rota. Veja em Solicitações pendentes.',
    'shipments_deliveries'
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_driver_shipment_on_trip() IS
  'Quando shipment sem base é vinculado a scheduled_trip (insert ou troca de trip), notifica o motorista.';

DROP TRIGGER IF EXISTS on_shipment_trip_notify_driver ON public.shipments;
CREATE TRIGGER on_shipment_trip_notify_driver
  AFTER INSERT OR UPDATE OF scheduled_trip_id, status, driver_id, base_id ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_shipment_on_trip();
