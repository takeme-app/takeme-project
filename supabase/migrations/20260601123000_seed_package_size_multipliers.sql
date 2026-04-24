-- Seed `shipment_package_size_multipliers` em platform_settings.
-- Migra o valor anteriormente hardcoded em apps/cliente/src/lib/shipmentQuote.ts
-- para a base, permitindo que o admin ajuste via Configurações sem re-deploy.

INSERT INTO public.platform_settings (key, value)
VALUES (
  'shipment_package_size_multipliers',
  jsonb_build_object(
    'pequeno', 1,
    'medio', 1.12,
    'grande', 1.28
  )
)
ON CONFLICT (key) DO NOTHING;
