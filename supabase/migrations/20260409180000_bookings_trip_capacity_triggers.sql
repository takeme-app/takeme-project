-- Coluna usada por charge-booking / estornos (idempotente se já existir).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text NULL;

-- Capacidade transacional: reservas pending/paid/confirmed consomem seats_available;
-- confirmed_count incrementa ao confirmar (motorista); devolução ao cancelar reserva (viagem ainda active)
-- ou ao apagar reserva. SECURITY DEFINER para contornar RLS em scheduled_trips.

CREATE OR REPLACE FUNCTION public.bookings_manage_trip_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trip_is_active boolean;
  rows_updated int;
  pax int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    pax := COALESCE(NEW.passenger_count, 0);
    IF pax < 1 THEN
      RAISE EXCEPTION 'passenger_count inválido';
    END IF;

    IF NEW.status IN ('pending', 'paid', 'confirmed') THEN
      UPDATE public.scheduled_trips st
      SET
        seats_available = st.seats_available - pax,
        confirmed_count = st.confirmed_count + CASE WHEN NEW.status = 'confirmed' THEN pax ELSE 0 END,
        updated_at = now()
      WHERE st.id = NEW.scheduled_trip_id
        AND st.status = 'active'
        AND st.seats_available >= pax;

      GET DIAGNOSTICS rows_updated = ROW_COUNT;
      IF rows_updated = 0 THEN
        RAISE EXCEPTION 'Capacidade insuficiente ou viagem indisponível para esta reserva'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    pax := COALESCE(OLD.passenger_count, 0);
    IF OLD.status IN ('pending', 'paid', 'confirmed') AND pax >= 1 THEN
      SELECT (st.status = 'active') INTO trip_is_active
      FROM public.scheduled_trips st
      WHERE st.id = OLD.scheduled_trip_id;

      IF trip_is_active THEN
        UPDATE public.scheduled_trips
        SET
          seats_available = seats_available + pax,
          confirmed_count = CASE
            WHEN OLD.status = 'confirmed' THEN GREATEST(0, confirmed_count - pax)
            ELSE confirmed_count
          END,
          updated_at = now()
        WHERE id = OLD.scheduled_trip_id;
      END IF;
    END IF;

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Cancelamento de reserva: devolve lugares se a viagem ainda está ativa
    IF OLD.status IN ('pending', 'paid', 'confirmed')
       AND NEW.status = 'cancelled'
       AND OLD.status IS DISTINCT FROM NEW.status
    THEN
      pax := COALESCE(OLD.passenger_count, 0);
      SELECT (st.status = 'active') INTO trip_is_active
      FROM public.scheduled_trips st
      WHERE st.id = NEW.scheduled_trip_id;

      IF trip_is_active AND pax >= 1 THEN
        UPDATE public.scheduled_trips
        SET
          seats_available = seats_available + pax,
          confirmed_count = CASE
            WHEN OLD.status = 'confirmed' THEN GREATEST(0, confirmed_count - pax)
            ELSE confirmed_count
          END,
          updated_at = now()
        WHERE id = NEW.scheduled_trip_id;
      END IF;

      RETURN NEW;
    END IF;

    -- Motorista confirmou: passageiros já ocupavam lugar desde pending/paid
    IF NEW.status = 'confirmed'
       AND OLD.status IS DISTINCT FROM NEW.status
       AND OLD.status IN ('pending', 'paid')
    THEN
      pax := COALESCE(NEW.passenger_count, 0);
      IF pax >= 1 THEN
        UPDATE public.scheduled_trips
        SET
          confirmed_count = confirmed_count + pax,
          updated_at = now()
        WHERE id = NEW.scheduled_trip_id
          AND status = 'active';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.bookings_manage_trip_capacity() IS
  'Mantém seats_available/confirmed_count alinhados a INSERT/UPDATE/DELETE de bookings.';

DROP TRIGGER IF EXISTS trg_bookings_manage_trip_capacity ON public.bookings;

CREATE TRIGGER trg_bookings_manage_trip_capacity
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.bookings_manage_trip_capacity();

COMMENT ON TABLE public.bookings IS
  'Reservas de viagem; status pending/confirmed/paid/cancelled. Concluído na UI = scheduled_trips.completed + reserva não cancelada.';
