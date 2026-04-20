-- Idempotência para a notificação "Falta 1 hora para iniciar sua próxima viagem".
-- A Edge Function schedulada (notify-driver-upcoming-trips) só dispara quando
-- este campo está NULL; após o envio, preenche com now() e não repete.

ALTER TABLE public.scheduled_trips
  ADD COLUMN IF NOT EXISTS upcoming_1h_notified_at timestamptz NULL;

COMMENT ON COLUMN public.scheduled_trips.upcoming_1h_notified_at IS
  'Quando foi enviada a notificação "1h antes" ao motorista. NULL = nunca enviada; evita re-dispatch pela cron.';

CREATE INDEX IF NOT EXISTS idx_scheduled_trips_upcoming_1h_dispatch
  ON public.scheduled_trips (departure_at)
  WHERE status = 'active' AND upcoming_1h_notified_at IS NULL;
