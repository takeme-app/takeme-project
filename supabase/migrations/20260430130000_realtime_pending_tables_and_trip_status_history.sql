-- Realtime: tabelas usadas em PendingRequestsScreen e paradas da viagem ativa.
-- status_history: registrar mudanças de status em scheduled_trips (entity_type = trip).

-- ---------------------------------------------------------------------------
-- Publication supabase_realtime
-- ---------------------------------------------------------------------------
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'worker_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_assignments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'shipments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'trip_stops'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_stops;
  END IF;
END $migration$;

-- ---------------------------------------------------------------------------
-- status_history: incluir viagens (scheduled_trips) como entity_type = trip
-- ---------------------------------------------------------------------------
ALTER TABLE public.status_history DROP CONSTRAINT IF EXISTS status_history_entity_type_check;

ALTER TABLE public.status_history ADD CONSTRAINT status_history_entity_type_check CHECK (
  entity_type = ANY (ARRAY[
    'booking'::text,
    'shipment'::text,
    'dependent_shipment'::text,
    'excursion'::text,
    'trip'::text
  ])
);

CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  etype text;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'bookings'             THEN etype := 'booking';
    WHEN 'shipments'            THEN etype := 'shipment';
    WHEN 'dependent_shipments'  THEN etype := 'dependent_shipment';
    WHEN 'excursion_requests'   THEN etype := 'excursion';
    WHEN 'scheduled_trips'      THEN etype := 'trip';
    ELSE etype := TG_TABLE_NAME;
  END CASE;

  IF TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.status_history (entity_type, entity_id, status, changed_at)
    VALUES (etype, NEW.id, NEW.status, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scheduled_trips_status_history ON public.scheduled_trips;
CREATE TRIGGER trg_scheduled_trips_status_history
  AFTER INSERT OR UPDATE OF status ON public.scheduled_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.log_status_change();

COMMENT ON TRIGGER trg_scheduled_trips_status_history ON public.scheduled_trips IS
  'Auditoria em status_history (entity_type = trip) alinhada ao PRD motorista.';
