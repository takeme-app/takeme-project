-- Painel admin: cadastrar veículo em nome do motorista + upload no bucket vehicles.

ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS renavam text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS use_type text;

DROP POLICY IF EXISTS "Admin can insert vehicles" ON public.vehicles;
CREATE POLICY "Admin can insert vehicles"
  ON public.vehicles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

COMMENT ON POLICY "Admin can insert vehicles" ON public.vehicles IS
  'Admin (is_admin): INSERT em vehicles para o fluxo web de edição de motorista.';

DROP POLICY IF EXISTS "Admin can upload vehicles bucket storage" ON storage.objects;
CREATE POLICY "Admin can upload vehicles bucket storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    lower(bucket_id::text) = 'vehicles'
    AND public.is_admin()
  );

COMMENT ON POLICY "Admin can upload vehicles bucket storage" ON storage.objects IS
  'Admin: INSERT de objetos no bucket vehicles (documento/fotos ao cadastrar veículo).';

DROP POLICY IF EXISTS "Admin can update vehicles bucket storage" ON storage.objects;
CREATE POLICY "Admin can update vehicles bucket storage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    lower(bucket_id::text) = 'vehicles'
    AND public.is_admin()
  )
  WITH CHECK (
    lower(bucket_id::text) = 'vehicles'
    AND public.is_admin()
  );

COMMENT ON POLICY "Admin can update vehicles bucket storage" ON storage.objects IS
  'Admin: UPDATE (upsert) no bucket vehicles.';
