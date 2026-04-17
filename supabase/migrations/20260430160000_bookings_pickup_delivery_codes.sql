-- PINs de embarque e desembarque por reserva (bookings), distintos entre si.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pickup_code text NULL,
  ADD COLUMN IF NOT EXISTS delivery_code text NULL;

COMMENT ON COLUMN public.bookings.pickup_code IS 'Código de 4 dígitos que o passageiro informa ao motorista no embarque.';
COMMENT ON COLUMN public.bookings.delivery_code IS 'Código de 4 dígitos que o passageiro informa ao motorista no desembarque.';

-- Reutiliza gerador já usado em shipments (migração 20260326000000).
CREATE OR REPLACE FUNCTION public.generate_booking_trip_codes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pickup_code IS NULL OR btrim(NEW.pickup_code) = '' THEN
    NEW.pickup_code := public.generate_4digit_code();
  END IF;
  IF NEW.delivery_code IS NULL OR btrim(NEW.delivery_code) = '' THEN
    NEW.delivery_code := public.generate_4digit_code();
  END IF;
  WHILE NEW.delivery_code IS NOT DISTINCT FROM NEW.pickup_code LOOP
    NEW.delivery_code := public.generate_4digit_code();
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_generate_trip_codes ON public.bookings;
CREATE TRIGGER trg_bookings_generate_trip_codes
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_booking_trip_codes();

-- Reservas antigas sem PIN
DO $$
DECLARE
  r RECORD;
  p text;
  d text;
BEGIN
  FOR r IN
    SELECT id
    FROM public.bookings
    WHERE pickup_code IS NULL
       OR delivery_code IS NULL
       OR length(regexp_replace(coalesce(pickup_code, ''), '\D', '', 'g')) <> 4
       OR length(regexp_replace(coalesce(delivery_code, ''), '\D', '', 'g')) <> 4
  LOOP
    p := public.generate_4digit_code();
    d := public.generate_4digit_code();
    WHILE d = p LOOP
      d := public.generate_4digit_code();
    END LOOP;
    UPDATE public.bookings
    SET pickup_code = p, delivery_code = d, updated_at = now()
    WHERE id = r.id;
  END LOOP;
END;
$$;
