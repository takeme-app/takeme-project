-- trip-expenses: políticas de storage com split_part (mais previsível que storage.foldername).
--
-- Se ao executar aparecer: ERROR 42501: must be owner of relation objects
-- ---------------------------------------------------------------------------
-- Isso é esperado no SQL Editor do painel Supabase: `storage.objects` pertence à
-- infraestrutura de Storage, não ao papel que executa consultas ad hoc.
--
-- Como aplicar:
-- 1) Preferencial: na máquina local, com o projeto linkado:
--      supabase link
--      supabase db push
--    (usa a connection string do banco do projeto; costuma ter permissão para policies.)
--
-- 2) Ou: psql com a URI "Database" (porta 5432, usuário postgres) do painel
--    Settings → Database → Connection string → Session mode / direct.
--
-- 3) Ou: Dashboard → Storage → bucket trip-expenses → Policies → criar/editar
--    políticas equivalentes (INSERT/SELECT/DELETE/UPDATE) com as mesmas expressões
--    em USING / WITH CHECK abaixo.
--
-- Não use COMMENT ON POLICY aqui: no painel pode falhar pelo mesmo motivo de owner.

DROP POLICY IF EXISTS "Trip expenses upload" ON storage.objects;
CREATE POLICY "Trip expenses upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    lower(bucket_id::text) = 'trip-expenses'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Trip expenses read own" ON storage.objects;
CREATE POLICY "Trip expenses read own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    lower(bucket_id::text) = 'trip-expenses'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Trip expenses delete own" ON storage.objects;
CREATE POLICY "Trip expenses delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    lower(bucket_id::text) = 'trip-expenses'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Trip expenses update own" ON storage.objects;
CREATE POLICY "Trip expenses update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    lower(bucket_id::text) = 'trip-expenses'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    lower(bucket_id::text) = 'trip-expenses'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
