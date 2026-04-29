-- =============================================================================
-- Cenário 1 (PDF "Sequência de Solicitação de Código"): viagem comum tem APENAS
-- 1 PIN (no embarque). O PDF não prevê PIN no desembarque.
--
-- Antes: bookings tinha pickup_code + delivery_code, ambos gerados por trigger.
-- Depois: apenas pickup_code é gerado. delivery_code permanece na tabela como
-- nullable (compatibilidade), mas não é mais preenchido em novas reservas.
--
-- A coluna NÃO é dropada para preservar histórico. Apps devem ignorá-la.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_booking_trip_codes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pickup_code IS NULL OR btrim(NEW.pickup_code) = '' THEN
    NEW.pickup_code := public.generate_4digit_code();
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.generate_booking_trip_codes() IS
  'Gera apenas pickup_code para bookings. delivery_code foi descontinuado conforme PDF "Sequência de Solicitação de Código" (viagem comum tem só 1 PIN).';

COMMENT ON COLUMN public.bookings.delivery_code IS
  'DEPRECATED: viagem comum não tem PIN de desembarque (PDF Sequência de Solicitação de Código). Coluna mantida para histórico.';
