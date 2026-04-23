-- =====================================================================
-- Excursão: controle idempotente da notificação "viagem inicia em 40 min"
-- para o preparador de excursão. Alimenta a edge function
-- `notify-preparer-excursion-upcoming` (cron).
-- =====================================================================

ALTER TABLE public.excursion_requests
  ADD COLUMN IF NOT EXISTS upcoming_40min_notified_at timestamptz;

COMMENT ON COLUMN public.excursion_requests.upcoming_40min_notified_at IS
  'Marca que a notificação "Sua viagem inciará em 40 minutos" já foi entregue ao preparer_id (idempotência do cron).';
