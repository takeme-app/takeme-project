-- Média em profiles.rating a partir de trip_ratings (motorista → passageiros da viagem)
-- e shipment_driver_ratings (motorista → remetente do envio).

-- ---------------------------------------------------------------------------
-- shipment_driver_ratings: avaliação do motorista após entrega (1 por envio)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipment_driver_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments (id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shipment_id)
);

CREATE INDEX IF NOT EXISTS idx_shipment_driver_ratings_shipment_id
  ON public.shipment_driver_ratings (shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_driver_ratings_driver_id
  ON public.shipment_driver_ratings (driver_id);

COMMENT ON TABLE public.shipment_driver_ratings IS
  'Avaliação opcional do motorista após entregar o envio (1–5 + comentário). Distinta de shipment_ratings (avaliação do cliente).';

ALTER TABLE public.shipment_driver_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers read own shipment_driver_ratings" ON public.shipment_driver_ratings;
CREATE POLICY "Drivers read own shipment_driver_ratings"
  ON public.shipment_driver_ratings FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

DROP POLICY IF EXISTS "Clients read shipment_driver_ratings for own shipments" ON public.shipment_driver_ratings;
CREATE POLICY "Clients read shipment_driver_ratings for own shipments"
  ON public.shipment_driver_ratings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shipments s
      WHERE s.id = shipment_driver_ratings.shipment_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers insert shipment_driver_ratings for delivered shipment" ON public.shipment_driver_ratings;
CREATE POLICY "Drivers insert shipment_driver_ratings for delivered shipment"
  ON public.shipment_driver_ratings FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.shipments s
      WHERE s.id = shipment_driver_ratings.shipment_id
        AND s.driver_id = auth.uid()
        AND s.status = 'delivered'
    )
  );

DROP POLICY IF EXISTS "Drivers update own shipment_driver_ratings" ON public.shipment_driver_ratings;
CREATE POLICY "Drivers update own shipment_driver_ratings"
  ON public.shipment_driver_ratings FOR UPDATE TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (
    driver_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.shipments s
      WHERE s.id = shipment_driver_ratings.shipment_id
        AND s.driver_id = auth.uid()
        AND s.status = 'delivered'
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.shipment_driver_ratings TO authenticated;
GRANT ALL ON public.shipment_driver_ratings TO service_role;

-- ---------------------------------------------------------------------------
-- trip_ratings: passageiro com reserva paga/confirmada pode ler a nota
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Passengers read trip_ratings for own booking" ON public.trip_ratings;
CREATE POLICY "Passengers read trip_ratings for own booking"
  ON public.trip_ratings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.scheduled_trip_id = trip_ratings.trip_id
        AND b.user_id = auth.uid()
        AND b.status IN ('paid', 'confirmed')
    )
  );

-- ---------------------------------------------------------------------------
-- Admin read (additive)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin can read all trip_ratings" ON public.trip_ratings;
CREATE POLICY "Admin can read all trip_ratings"
  ON public.trip_ratings FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin can read all shipment_driver_ratings" ON public.shipment_driver_ratings;
CREATE POLICY "Admin can read all shipment_driver_ratings"
  ON public.shipment_driver_ratings FOR SELECT
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- Recompute profiles.rating (passageiro / remetente)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_passenger_profile_rating(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_val numeric;
BEGIN
  SELECT AVG(x.r)::numeric
  INTO avg_val
  FROM (
    SELECT tr.rating::numeric AS r
    FROM public.trip_ratings tr
    WHERE EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.scheduled_trip_id = tr.trip_id
        AND b.user_id = p_user_id
        AND b.status IN ('paid', 'confirmed')
    )
    UNION ALL
    SELECT sdr.rating::numeric AS r
    FROM public.shipment_driver_ratings sdr
    INNER JOIN public.shipments s ON s.id = sdr.shipment_id
    WHERE s.user_id = p_user_id
  ) x;

  UPDATE public.profiles
  SET
    rating = CASE
      WHEN avg_val IS NULL THEN NULL
      ELSE ROUND(avg_val, 1)::numeric(2, 1)
    END,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.recompute_passenger_profile_rating(uuid) IS
  'Recalcula profiles.rating como média de trip_ratings + shipment_driver_ratings relevantes ao utilizador.';

REVOKE ALL ON FUNCTION public.recompute_passenger_profile_rating(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.recompute_passenger_ratings_for_trip(p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT b.user_id AS uid
    FROM public.bookings b
    WHERE b.scheduled_trip_id = p_trip_id
      AND b.status IN ('paid', 'confirmed')
  LOOP
    PERFORM public.recompute_passenger_profile_rating(r.uid);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.recompute_passenger_ratings_for_trip(uuid) IS
  'Recalcula profiles.rating para todos os passageiros com reserva paga/confirmada nesta viagem.';

REVOKE ALL ON FUNCTION public.recompute_passenger_ratings_for_trip(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.tg_trip_ratings_recompute_passenger_ratings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    t_id := OLD.trip_id;
  ELSE
    t_id := NEW.trip_id;
  END IF;
  PERFORM public.recompute_passenger_ratings_for_trip(t_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.tg_trip_ratings_recompute_passenger_ratings() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_trip_ratings_recompute_passenger_ratings ON public.trip_ratings;
CREATE TRIGGER trg_trip_ratings_recompute_passenger_ratings
  AFTER INSERT OR UPDATE OR DELETE ON public.trip_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_trip_ratings_recompute_passenger_ratings();

CREATE OR REPLACE FUNCTION public.tg_shipment_driver_ratings_recompute_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT s.user_id INTO uid FROM public.shipments s WHERE s.id = OLD.shipment_id;
  ELSE
    SELECT s.user_id INTO uid FROM public.shipments s WHERE s.id = NEW.shipment_id;
  END IF;
  IF uid IS NOT NULL THEN
    PERFORM public.recompute_passenger_profile_rating(uid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.tg_shipment_driver_ratings_recompute_profile() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_shipment_driver_ratings_recompute_profile ON public.shipment_driver_ratings;
CREATE TRIGGER trg_shipment_driver_ratings_recompute_profile
  AFTER INSERT OR UPDATE OR DELETE ON public.shipment_driver_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_shipment_driver_ratings_recompute_profile();

-- ---------------------------------------------------------------------------
-- Backfill: utilizadores com trip_ratings ligados a reservas elegíveis
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT b.user_id AS uid
    FROM public.bookings b
    INNER JOIN public.trip_ratings tr ON tr.trip_id = b.scheduled_trip_id
    WHERE b.status IN ('paid', 'confirmed')
  LOOP
    PERFORM public.recompute_passenger_profile_rating(r.uid);
  END LOOP;
END $$;
