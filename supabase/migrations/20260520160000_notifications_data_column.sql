-- Deeplink por notificação: payload genérico em `data` no formato
--   { "route": "TripDetail", "params": { "tripId": "..." } }
-- Consumido pelo app motorista (e cliente, quando aplicável) tanto no toque
-- do inbox quanto via FCM (onNotificationOpenedApp / getInitialNotification).

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS data jsonb NULL;

COMMENT ON COLUMN public.notifications.data IS
  'Payload opcional para deeplink/navegação. Formato livre JSON, ex.: {"route":"ActiveTrip","params":{"tripId":"..."}}.';
