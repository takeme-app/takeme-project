-- Múltiplas fotos da encomenda (app cliente): `photo_url` mantém o primeiro path para compatibilidade;
-- `photo_paths` guarda todos os paths no bucket shipment-photos (ordem).

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS photo_paths jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.dependent_shipments
  ADD COLUMN IF NOT EXISTS photo_paths jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.shipments.photo_paths IS 'Array JSON de paths no storage shipment-photos; photo_url = primeiro quando houver.';
COMMENT ON COLUMN public.dependent_shipments.photo_paths IS 'Array JSON de paths no storage shipment-photos; photo_url = primeiro quando houver.';
