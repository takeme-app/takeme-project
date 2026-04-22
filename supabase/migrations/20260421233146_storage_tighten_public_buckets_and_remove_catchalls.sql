-- Hardening de storage.objects (21/abr/2026).
--
-- OBJETIVOS
-- 1) Satisfazer advisor public_bucket_allows_listing para avatars/vehicles/payout-receipts:
--    os buckets continuam public=true, entao downloads via getPublicUrl (CDN)
--    continuam funcionando sem precisar de policy SELECT em storage.objects.
--    As policies broad de SELECT so serviam para habilitar .list(), que
--    nenhum app consome (somente dependent-documents usa .list e e bucket
--    privado, mantido sem alteracao).
-- 2) Remover a policy catastrofica "all policies" (cmd=ALL, roles=public,
--    qual=null, with_check=null) que permitia qualquer anon fazer qualquer
--    operacao em qualquer bucket.
-- 3) Remover as 4 policies leaky em driver-documents
--    ("all policies eqoggj_0..3") que davam CRUD completo a anon sobre
--    documentos sensiveis LGPD (CNH, antecedentes, CRLV).
-- 4) Remover public_read_chat_attachments (permitia anon listar/ler anexos
--    de conversas privadas). Policies granulares por conversa continuam
--    cobrindo acesso legitimo.
--
-- NENHUMA das remocoes afeta:
--  - Upload de avatar/fotos de veiculo/comprovantes (INSERT policies proprias
--    escopadas por auth.uid() continuam ativas).
--  - Leitura de avatar/fotos de veiculo via getPublicUrl (public=true do
--    bucket serve direto pela CDN).
--  - Leitura admin de vehicles/driver-documents (policies "Admin can read
--    all ..." mantidas).
--  - Leitura motorista de driver-documents (Driver docs read, escopada por
--    auth.uid()).
--  - Leitura de chat attachments por participantes/admin (policies
--    chat_attachments read participants/admin support mantidas).

-- Catch-all catastrofico: cmd=ALL, roles=public, qual=null
DROP POLICY IF EXISTS "all policies" ON storage.objects;

-- driver-documents catch-alls (cmd ALL para public, sem qual)
DROP POLICY IF EXISTS "all policies eqoggj_0" ON storage.objects;
DROP POLICY IF EXISTS "all policies eqoggj_1" ON storage.objects;
DROP POLICY IF EXISTS "all policies eqoggj_2" ON storage.objects;
DROP POLICY IF EXISTS "all policies eqoggj_3" ON storage.objects;

-- chat-attachments: bucket privado, public_read leaky
DROP POLICY IF EXISTS "public_read_chat_attachments" ON storage.objects;

-- avatars (public=true): SELECT amplo; downloads continuam via public URL
DROP POLICY IF EXISTS "Profile avatars read" ON storage.objects;

-- vehicles (public=true): SELECT amplo; downloads continuam via public URL
DROP POLICY IF EXISTS "vehicles_public_read" ON storage.objects;

-- payout-receipts (public=true): SELECT amplo; admin continua lendo via public URL
DROP POLICY IF EXISTS "Anyone can read payout receipts" ON storage.objects;
