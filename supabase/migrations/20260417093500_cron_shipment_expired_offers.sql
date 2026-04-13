-- Agenda processamento da fila de ofertas de envio (expiração / próximo motorista).
-- Só roda se pg_cron existir (evita falha em ambientes sem extensão).

DO $cron$
DECLARE
  jid bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'shipment-process-expired-offers'
    LOOP
      PERFORM cron.unschedule(jid);
    END LOOP;
    PERFORM cron.schedule(
      'shipment-process-expired-offers',
      '* * * * *',
      $$SELECT public.shipment_process_expired_driver_offers();$$
    );
  END IF;
END;
$cron$;
