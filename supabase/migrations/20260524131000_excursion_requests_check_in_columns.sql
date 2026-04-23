-- =====================================================================
-- Excursão: colunas para marcar o início das fases de check-in (ida/volta).
--
-- Fase 5 das notificações (cliente - excursão). Quando o admin/preparador
-- inicia cada check-in, preenche a coluna correspondente; o trigger
-- dedicado (ver 20260524140000_*) dispara o push com o texto literal do
-- spec ("Sua Excursão está em fase de check in de ida." / "... de volta.").
-- =====================================================================

ALTER TABLE public.excursion_requests
  ADD COLUMN IF NOT EXISTS check_in_ida_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS check_in_volta_started_at timestamptz;

COMMENT ON COLUMN public.excursion_requests.check_in_ida_started_at IS
  'Marca o início da fase de check-in de ida; alimenta a notificação literal do spec.';
COMMENT ON COLUMN public.excursion_requests.check_in_volta_started_at IS
  'Marca o início da fase de check-in de volta; alimenta a notificação literal do spec.';
