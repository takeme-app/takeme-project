-- ============================================================================
-- Exemplos de encomendas (shipments) para preparador de encomendas — dev/local
-- ============================================================================
-- Executar no SQL Editor do Supabase com role que bypassa RLS (ex.: postgres).
--
-- Preparador (mesmo UUID do worker_profiles / auth.users):
--   3101029e-00f6-4be5-b95d-318b06ba45cd
--
-- O script escolhe automaticamente um cliente: primeiro auth.users com id
-- diferente do preparador. Se não existir, aborta com mensagem clara.
--
-- Colunas extras (driver_id, códigos de coleta, etc.): se o projeto ainda não
-- rodou migrations como 20250320100000_driver_requests_rls.sql e trechos de
-- 20260326000000_complete_migration_etapas_1_10.sql, elas são criadas aqui.
-- ============================================================================

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS driver_accepted_at timestamptz;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS pickup_code text,
  ADD COLUMN IF NOT EXISTS delivery_code text,
  ADD COLUMN IF NOT EXISTS picked_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

DO $$
DECLARE
  preparer_id constant uuid := '3101029e-00f6-4be5-b95d-318b06ba45cd';
  client_id   uuid;
  s1 uuid;
  s2 uuid;
  s3 uuid;
  s4 uuid;
  s5 uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = preparer_id) THEN
    RAISE EXCEPTION 'Usuário preparador % não existe em auth.users.', preparer_id;
  END IF;

  SELECT u.id INTO client_id
  FROM auth.users u
  WHERE u.id <> preparer_id
  ORDER BY u.created_at ASC
  LIMIT 1;

  IF client_id IS NULL THEN
    RAISE EXCEPTION
      'É necessário pelo menos um outro usuário (cliente) em auth.users além do preparador. Crie um no Auth ou cadastre pelo app.';
  END IF;

  UPDATE public.profiles
  SET
    full_name = COALESCE(NULLIF(trim(full_name), ''), 'Maria Silva (demo encomendas)'),
    updated_at = now()
  WHERE id = client_id;

  -- 1–2: pendentes na fila do preparador (aba Início → Ações necessárias)
  INSERT INTO public.shipments (
    user_id,
    origin_address, origin_lat, origin_lng,
    destination_address, destination_lat, destination_lng,
    when_option, scheduled_at,
    package_size,
    recipient_name, recipient_email, recipient_phone,
    instructions, photo_url,
    payment_method, amount_cents,
    status,
    driver_id, driver_accepted_at
  ) VALUES (
    client_id,
    'Av. Litorânea, 1200 — São Luís, MA', -2.53844, -44.2825,
    'Shopping da Ilha — São Luís, MA', -2.50012, -44.2658,
    'now', now() + interval '2 hours',
    'pequeno',
    'Maria Silva', 'maria.demo@example.com', '98988887777',
    'Fragil — manusear com cuidado.', NULL,
    'pix', 1890,
    'pending_review',
    NULL, NULL
  )
  RETURNING id INTO s1;

  INSERT INTO public.shipments (
    user_id,
    origin_address, origin_lat, origin_lng,
    destination_address, destination_lat, destination_lng,
    when_option, scheduled_at,
    package_size,
    recipient_name, recipient_email, recipient_phone,
    instructions, photo_url,
    payment_method, amount_cents,
    status,
    driver_id, driver_accepted_at
  ) VALUES (
    client_id,
    'Rua Grande, 300 — Centro, São Luís', -2.5297, -44.3028,
    'Av. dos Holandeses, 10 — Calhau, São Luís', -2.4933, -44.3010,
    'later', now() + interval '1 day',
    'medio',
    'Maria Silva', 'maria.demo@example.com', '98988887777',
    'Entregar na portaria.', NULL,
    'card', 4590,
    'pending_review',
    NULL, NULL
  )
  RETURNING id INTO s2;

  -- 3: coleta atribuída ao preparador (aba Coletas → Em rota)
  INSERT INTO public.shipments (
    user_id,
    origin_address, origin_lat, origin_lng,
    destination_address, destination_lat, destination_lng,
    when_option, scheduled_at,
    package_size,
    recipient_name, recipient_email, recipient_phone,
    instructions, photo_url,
    payment_method, amount_cents,
    status,
    driver_id, driver_accepted_at
  ) VALUES (
    client_id,
    'Terminal de Cujupe — São José de Ribamar, MA', -2.5489, -44.0512,
    'Base Take Me — São Luís, MA', -2.5300, -44.2900,
    'now', now() + interval '30 minutes',
    'medio',
    'Maria Silva', 'maria.demo@example.com', '98988887777',
    'Coletar com nota fiscal anexa ao pacote.', NULL,
    'pix', 6200,
    'confirmed',
    preparer_id, now() - interval '15 minutes'
  )
  RETURNING id INTO s3;

  -- 4–5: entregues (histórico / relatórios)
  INSERT INTO public.shipments (
    user_id,
    origin_address, origin_lat, origin_lng,
    destination_address, destination_lat, destination_lng,
    when_option, scheduled_at,
    package_size,
    recipient_name, recipient_email, recipient_phone,
    instructions, photo_url,
    payment_method, amount_cents,
    status,
    driver_id, driver_accepted_at,
    picked_up_at, delivered_at
  ) VALUES (
    client_id,
    'Rua da Paz, 45 — Renascença II', -2.5167, -44.2389,
    'Condomínio Solar, Qd 12 — São Luís', -2.5080, -44.2200,
    'now', now() - interval '3 days',
    'pequeno',
    'Maria Silva', 'maria.demo@example.com', '98988887777',
    NULL, NULL,
    'pix', 2100,
    'delivered',
    preparer_id, now() - interval '3 days' + interval '10 minutes',
    now() - interval '3 days' + interval '25 minutes',
    now() - interval '3 days' + interval '50 minutes'
  )
  RETURNING id INTO s4;

  INSERT INTO public.shipments (
    user_id,
    origin_address, origin_lat, origin_lng,
    destination_address, destination_lat, destination_lng,
    when_option, scheduled_at,
    package_size,
    recipient_name, recipient_email, recipient_phone,
    instructions, photo_url,
    payment_method, amount_cents,
    status,
    driver_id, driver_accepted_at,
    picked_up_at, delivered_at
  ) VALUES (
    client_id,
    'Feira da Cidade Operária — São Luís', -2.5644, -44.2108,
    'Residencial Turu — São Luís', -2.5480, -44.2050,
    'later', now() - interval '10 days',
    'grande',
    'Maria Silva', 'maria.demo@example.com', '98988887777',
    'Pacote volumoso — necessário veículo adequado.', NULL,
    'pix', 12800,
    'delivered',
    preparer_id, now() - interval '10 days',
    now() - interval '10 days' + interval '1 hour',
    now() - interval '10 days' + interval '2 hours'
  )
  RETURNING id INTO s5;

  RAISE NOTICE 'Shipments de exemplo criados. IDs: %, %, %, %, % (cliente %).',
    s1, s2, s3, s4, s5, client_id;
END $$;
