-- Ao definir `driver_journey_started_at`, cancelar pedidos ainda não aceitos pelo motorista
-- (reserva paid/pending, encomenda sem driver_id, dependente em pending_review).
-- Motivo uniforme para o app cliente mostrar "Reembolsada" e para a edge function de estorno.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancellation_reason text NULL;

ALTER TABLE public.dependent_shipments
  ADD COLUMN IF NOT EXISTS cancellation_reason text NULL;

COMMENT ON COLUMN public.bookings.cancellation_reason IS
  'ex.: driver_journey_started_not_accepted quando o motorista inicia a viagem sem aceitar a reserva.';
COMMENT ON COLUMN public.dependent_shipments.cancellation_reason IS
  'ex.: driver_journey_started_not_accepted quando o motorista inicia a viagem sem aceitar o envio.';

CREATE OR REPLACE FUNCTION public.cancel_pending_not_accepted_on_driver_journey_start()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.driver_journey_started_at IS NOT NULL OR NEW.driver_journey_started_at IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.bookings
  SET
    status = 'cancelled',
    cancellation_reason = 'driver_journey_started_not_accepted',
    updated_at = now()
  WHERE scheduled_trip_id = NEW.id
    AND status = ANY (ARRAY['pending'::text, 'paid'::text]);

  UPDATE public.shipments
  SET
    status = 'cancelled',
    cancellation_reason = 'driver_journey_started_not_accepted',
    updated_at = now()
  WHERE scheduled_trip_id = NEW.id
    AND driver_id IS NULL
    AND status = ANY (ARRAY['pending_review'::text, 'confirmed'::text]);

  UPDATE public.dependent_shipments
  SET
    status = 'cancelled',
    cancellation_reason = 'driver_journey_started_not_accepted',
    updated_at = now()
  WHERE scheduled_trip_id = NEW.id
    AND status = 'pending_review'::text;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.cancel_pending_not_accepted_on_driver_journey_start() IS
  'BEFORE UPDATE: ao preencher driver_journey_started_at, cancela entidades não aceitas (motivo driver_journey_started_not_accepted).';

DROP TRIGGER IF EXISTS trg_cancel_pending_not_accepted_before_journey ON public.scheduled_trips;
CREATE TRIGGER trg_cancel_pending_not_accepted_before_journey
  BEFORE UPDATE OF driver_journey_started_at ON public.scheduled_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_pending_not_accepted_on_driver_journey_start();
