-- Painel admin: visualizar documentos/fotos de motoristas no Storage (URLs assinadas).
-- Sem isto, createSignedUrl falha por RLS para paths de outros usuários em buckets privados.

DROP POLICY IF EXISTS "Admin can read all driver documents storage" ON storage.objects;
CREATE POLICY "Admin can read all driver documents storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    lower(bucket_id::text) = 'driver-documents'
    AND public.is_admin()
  );

COMMENT ON POLICY "Admin can read all driver documents storage" ON storage.objects IS
  'JWT app_metadata.role=admin: SELECT em driver-documents para exibir CNH/fotos no painel.';

-- Bucket "vehicles" (fotos pelo VehicleFormScreen) — criar no Dashboard se ainda não existir.
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicles', 'vehicles', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admin can read all vehicles bucket storage" ON storage.objects;
CREATE POLICY "Admin can read all vehicles bucket storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    lower(bucket_id::text) = 'vehicles'
    AND public.is_admin()
  );

COMMENT ON POLICY "Admin can read all vehicles bucket storage" ON storage.objects IS
  'JWT app_metadata.role=admin: SELECT no bucket vehicles para fotos de veículo.';
