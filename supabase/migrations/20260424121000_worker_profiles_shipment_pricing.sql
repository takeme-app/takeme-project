-- Override de tarifa por preparador de encomendas + padrão global em platform_settings.
--
-- Hierarquia de precificação para encomendas (shipmentQuote.ts):
--   1) worker_profiles.shipment_{delivery,per_km}_fee_cents (override do preparador)
--   2) platform_settings.{shipment_base_delivery_fee_cents,km_price_cents} (padrão admin)
--   3) pricing_routes com role_type='preparer_shipments' (fallback retrocompatível)

ALTER TABLE public.worker_profiles
  ADD COLUMN IF NOT EXISTS shipment_delivery_fee_cents integer NULL
    CHECK (shipment_delivery_fee_cents IS NULL OR shipment_delivery_fee_cents >= 0),
  ADD COLUMN IF NOT EXISTS shipment_per_km_fee_cents integer NULL
    CHECK (shipment_per_km_fee_cents IS NULL OR shipment_per_km_fee_cents >= 0);

COMMENT ON COLUMN public.worker_profiles.shipment_delivery_fee_cents IS
  'Override por preparador do valor fixo por entrega (centavos). NULL = usar platform_settings.shipment_base_delivery_fee_cents.';
COMMENT ON COLUMN public.worker_profiles.shipment_per_km_fee_cents IS
  'Override por preparador do valor por km (centavos). NULL = usar platform_settings.km_price_cents.';

-- Seed do padrão global de entrega (complementa km_price_cents já existente).
INSERT INTO public.platform_settings (key, value)
VALUES ('shipment_base_delivery_fee_cents', '{"value": 500}'::jsonb)
ON CONFLICT (key) DO NOTHING;
