-- Preparador de excursões: novos campos de precificação
-- Adiciona colunas opcionais em worker_profiles para persistir o tipo de
-- remuneração e os valores base (hora OU diária), noturno e domingos/feriados.
-- Todas nullable para não quebrar drafts existentes (stage4 allow_draft).

ALTER TABLE public.worker_profiles
  ADD COLUMN IF NOT EXISTS pay_type text NULL
    CHECK (pay_type IS NULL OR pay_type IN ('hourly','daily')),
  ADD COLUMN IF NOT EXISTS hourly_rate_cents integer NULL
    CHECK (hourly_rate_cents IS NULL OR hourly_rate_cents >= 0),
  ADD COLUMN IF NOT EXISTS daily_rate_cents integer NULL
    CHECK (daily_rate_cents IS NULL OR daily_rate_cents >= 0),
  ADD COLUMN IF NOT EXISTS night_rate_cents integer NULL
    CHECK (night_rate_cents IS NULL OR night_rate_cents >= 0),
  ADD COLUMN IF NOT EXISTS holiday_rate_cents integer NULL
    CHECK (holiday_rate_cents IS NULL OR holiday_rate_cents >= 0);

COMMENT ON COLUMN public.worker_profiles.pay_type IS
  'Tipo de remuneração do preparador de excursões: hourly | daily.';
COMMENT ON COLUMN public.worker_profiles.hourly_rate_cents IS
  'Preço por hora (quando pay_type=hourly), em centavos.';
COMMENT ON COLUMN public.worker_profiles.daily_rate_cents IS
  'Preço por diária (quando pay_type=daily), em centavos.';
COMMENT ON COLUMN public.worker_profiles.night_rate_cents IS
  'Preço noturno (18h-04:59h) em centavos.';
COMMENT ON COLUMN public.worker_profiles.holiday_rate_cents IS
  'Preço para domingos e feriados em centavos.';
