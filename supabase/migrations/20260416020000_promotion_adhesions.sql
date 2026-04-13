-- Tabela de adesão a promoções (motorista/preparador aceita participar).
CREATE TABLE IF NOT EXISTS public.promotion_adhesions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type text NOT NULL CHECK (user_type IN ('motorista', 'preparador', 'passageiro')),
  adhered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promotion_id, user_id)
);

ALTER TABLE public.promotion_adhesions ENABLE ROW LEVEL SECURITY;

-- Admins podem ler tudo
CREATE POLICY promotion_adhesions_admin_read ON public.promotion_adhesions
  FOR SELECT USING (public.is_admin());

-- Usuários podem ler suas próprias adesões
CREATE POLICY promotion_adhesions_own_read ON public.promotion_adhesions
  FOR SELECT USING (auth.uid() = user_id);

-- Usuários autenticados podem aderir
CREATE POLICY promotion_adhesions_insert ON public.promotion_adhesions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_promotion_adhesions_promotion ON public.promotion_adhesions(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_adhesions_user ON public.promotion_adhesions(user_id);
CREATE INDEX IF NOT EXISTS idx_promotion_adhesions_adhered_at ON public.promotion_adhesions(adhered_at);
