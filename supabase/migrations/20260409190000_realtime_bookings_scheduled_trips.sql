-- Habilita Realtime para o admin atualizar a lista de viagens (postgres_changes).
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'scheduled_trips'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_trips;
  END IF;
END $migration$;
