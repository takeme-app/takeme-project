-- RLS batch 5 (21/abr/2026): worker_ratings.
-- Admin lê tudo (policy existente). Adicionamos self-read para quem foi avaliado (worker_id)
-- e para quem avaliou (rated_by), sem abrir acesso a terceiros.

DROP POLICY IF EXISTS "worker_ratings_worker_read_own" ON public.worker_ratings;
CREATE POLICY "worker_ratings_worker_read_own"
  ON public.worker_ratings FOR SELECT TO authenticated
  USING (worker_id = auth.uid());

DROP POLICY IF EXISTS "worker_ratings_rated_by_read_own" ON public.worker_ratings;
CREATE POLICY "worker_ratings_rated_by_read_own"
  ON public.worker_ratings FOR SELECT TO authenticated
  USING (rated_by = auth.uid());

ALTER TABLE public.worker_ratings ENABLE ROW LEVEL SECURITY;
