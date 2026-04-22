-- RLS batch 4 (21/abr/2026): promotions.
-- Admin lê tudo. Motorista/cliente precisam ler apenas promoções ativas dentro da janela start_at/end_at.

DROP POLICY IF EXISTS "promotions_authenticated_read_active" ON public.promotions;
CREATE POLICY "promotions_authenticated_read_active"
  ON public.promotions FOR SELECT TO authenticated
  USING (is_active = true AND start_at <= now() AND end_at >= now());

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
