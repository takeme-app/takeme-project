-- Idempotente: corrige erro "column shipments.picked_up_by_preparer_at does not exist".
-- Executar no Supabase Dashboard → SQL Editor (projeto takeme / xdxzxyzdgwpucwuaxvik).
-- Depois aplique também a migration completa do repo quando o histórico estiver alinhado:
--   supabase/migrations/20260603120000_shipments_handoff_codes.sql (trigger + backfill).

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS passenger_to_preparer_code text,
  ADD COLUMN IF NOT EXISTS preparer_to_base_code text,
  ADD COLUMN IF NOT EXISTS base_to_driver_code text,
  ADD COLUMN IF NOT EXISTS picked_up_by_preparer_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_to_base_at timestamptz,
  ADD COLUMN IF NOT EXISTS picked_up_by_driver_from_base_at timestamptz;

COMMENT ON COLUMN public.shipments.passenger_to_preparer_code IS
  'PIN A (cenário 3): passageiro valida.';
COMMENT ON COLUMN public.shipments.preparer_to_base_code IS
  'PIN B (cenário 3): validação preparador/base.';
COMMENT ON COLUMN public.shipments.base_to_driver_code IS
  'PIN C (cenário 3): retirada na base pelo motorista.';
COMMENT ON COLUMN public.shipments.picked_up_by_preparer_at IS
  'Timestamp após PIN A.';
COMMENT ON COLUMN public.shipments.delivered_to_base_at IS
  'Timestamp após PIN B.';
COMMENT ON COLUMN public.shipments.picked_up_by_driver_from_base_at IS
  'Timestamp após PIN C.';
