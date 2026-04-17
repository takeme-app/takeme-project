-- Bancos onde `trip_stops` já existia antes de 20260428103000 não ganharam `updated_at`
-- (CREATE TABLE IF NOT EXISTS não altera tabelas antigas). A RPC `complete_trip_stop` atualiza essa coluna.

ALTER TABLE public.trip_stops
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
