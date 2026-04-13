-- Coluna de % extra que o admin dá ao worker durante promoção.
-- Quando gain_pct_to_worker = 5, o admin perde 5% do seu ganho e o worker ganha +5%.
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS gain_pct_to_worker numeric(5,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.promotions.gain_pct_to_worker IS 'Porcentagem extra de ganho transferida do admin para o worker durante a promoção. Ex: 5 = admin perde 5%, worker ganha +5%.';

-- Tabela de configurações globais da plataforma.
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_settings_admin_all ON public.platform_settings
  FOR ALL USING (public.is_admin());

CREATE POLICY platform_settings_read ON public.platform_settings
  FOR SELECT USING (true);

-- Admin % padrão (15%)
INSERT INTO public.platform_settings (key, value)
VALUES ('default_admin_pct', '{"percentage": 15}'::jsonb)
ON CONFLICT (key) DO NOTHING;
