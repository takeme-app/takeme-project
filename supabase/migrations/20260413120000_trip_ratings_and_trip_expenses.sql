-- Avaliação da viagem pelo motorista + comprovantes de despesas (storage paths).

-- ---------------------------------------------------------------------------
-- trip_ratings (1 avaliação por motorista por viagem)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.scheduled_trips (id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_ratings_trip_id ON public.trip_ratings (trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_ratings_driver_id ON public.trip_ratings (driver_id);

COMMENT ON TABLE public.trip_ratings IS 'Avaliação opcional do motorista após concluir a viagem (1–5 + comentário).';

ALTER TABLE public.trip_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers read own trip ratings" ON public.trip_ratings;
CREATE POLICY "Drivers read own trip ratings"
  ON public.trip_ratings FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

DROP POLICY IF EXISTS "Drivers insert own trip ratings" ON public.trip_ratings;
CREATE POLICY "Drivers insert own trip ratings"
  ON public.trip_ratings FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.scheduled_trips st
      WHERE st.id = trip_id
        AND st.driver_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers update own trip ratings" ON public.trip_ratings;
CREATE POLICY "Drivers update own trip ratings"
  ON public.trip_ratings FOR UPDATE TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.trip_ratings TO authenticated;
GRANT ALL ON public.trip_ratings TO service_role;

-- ---------------------------------------------------------------------------
-- Caminhos dos anexos de despesa (bucket trip-expenses)
-- ---------------------------------------------------------------------------
ALTER TABLE public.scheduled_trips
  ADD COLUMN IF NOT EXISTS driver_expense_paths text[];

COMMENT ON COLUMN public.scheduled_trips.driver_expense_paths IS
  'Paths no bucket trip-expenses (ex.: {uid}/{trip_id}/arquivo.jpg) enviados ao finalizar a viagem.';

-- ---------------------------------------------------------------------------
-- Storage: trip-expenses/{driver_id}/{trip_id}/...
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-expenses', 'trip-expenses', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Trip expenses upload" ON storage.objects;
CREATE POLICY "Trip expenses upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'trip-expenses'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Trip expenses read own" ON storage.objects;
CREATE POLICY "Trip expenses read own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'trip-expenses'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Trip expenses delete own" ON storage.objects;
CREATE POLICY "Trip expenses delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'trip-expenses'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
