-- Quando uma viagem agendada é cancelada (ex.: app motorista), propaga o cancelamento
-- para todas as reservas ainda ativas dessa viagem. Evita divergência admin/cliente
-- (booking paid/confirmed + trip cancelled).
-- SECURITY DEFINER: motorista não tem UPDATE em bookings alheias via RLS; o trigger precisa aplicar a correção.

CREATE OR REPLACE FUNCTION public.sync_bookings_when_scheduled_trip_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  UPDATE public.bookings
  SET
    status = 'cancelled',
    updated_at = now()
  WHERE scheduled_trip_id = NEW.id
    AND status = ANY (ARRAY['pending'::text, 'paid'::text, 'confirmed'::text]);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_bookings_when_scheduled_trip_cancelled() IS
  'Ao cancelar scheduled_trips, cancela reservas pending/paid/confirmed vinculadas (auditoria via status_history em bookings).';

DROP TRIGGER IF EXISTS trg_sync_bookings_when_scheduled_trip_cancelled ON public.scheduled_trips;

CREATE TRIGGER trg_sync_bookings_when_scheduled_trip_cancelled
  AFTER INSERT OR UPDATE OF status ON public.scheduled_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_bookings_when_scheduled_trip_cancelled();
