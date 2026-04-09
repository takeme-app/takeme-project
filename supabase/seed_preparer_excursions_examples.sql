-- ============================================================================
-- Exemplos de excursões (excursion_requests) — preparador de excursões (dev/local)
-- ============================================================================
-- Executar no SQL Editor do Supabase com role que bypassa RLS (ex.: postgres).
--
-- Preparador (worker_profiles.id = auth.users.id):
--   af9a9dc8-cbd9-4873-a81e-be2211f19f76
--
-- O script escolhe um cliente: primeiro usuário em auth.users com id diferente
-- do preparador. Garanta um perfil em `profiles` (o script atualiza nome/telefone).
--
-- Status permitidos pelo CHECK atual: pending, contacted, quoted, cancelled,
-- in_analysis, approved, scheduled, in_progress, completed.
--
-- Observação: HistoricoExcursoesScreen filtra também 'confirmed', que não está
-- no CHECK padrão; use completed/cancelled para aparecer no histórico.
-- ============================================================================

DO $$
DECLARE
  preparer_id constant uuid := 'af9a9dc8-cbd9-4873-a81e-be2211f19f76';
  client_id   uuid;
  e_pending   uuid;
  e_quoted    uuid;
  e_approved  uuid;
  e_sched_today uuid;
  e_progress  uuid;
  e_sched_next uuid;
  e_done      uuid;
  e_cancel    uuid;
  -- Calendário “hoje” no fuso do Maranhão (alinhado ao uso típico em São Luís).
  d_today    date := (now() AT TIME ZONE 'America/Fortaleza')::date;
  d_tomorrow date := d_today + 1;
  d_past12   date := d_today - 12;
  d_past3    date := d_today - 3;
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
      'É necessário pelo menos um outro usuário (cliente) em auth.users além do preparador.';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, updated_at)
  VALUES (
    client_id,
    'Cliente Demo Excursões',
    '98991234567',
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = excluded.full_name,
    phone = excluded.phone,
    updated_at = now();

  -- 1) Hoje — pendente (Início: pode aceitar → approved)
  INSERT INTO public.excursion_requests (
    user_id, destination, excursion_date, people_count, fleet_type,
    first_aid_team, recreation_team, children_team, special_needs_team,
    recreation_items, observations, status,
    preparer_id, total_amount_cents, scheduled_departure_at,
    origin, origin_lat, origin_lng, destination_lat, destination_lng,
    budget_lines
  ) VALUES (
    client_id,
    'Barreirinhas — Lençóis Maranhenses',
    d_today,
    12,
    'van',
    false, true, false, false,
    '[]'::jsonb,
    'Saída do hotel em São Luís. Incluir parada para café.',
    'pending',
    preparer_id,
    NULL,
    (d_today + interval '7 hours') AT TIME ZONE 'America/Fortaleza',
    'São Luís, MA — Hotel Praia',
    -2.53844, -44.2825,
    -2.758, -42.825,
    '[]'::jsonb
  )
  RETURNING id INTO e_pending;

  -- 2) Hoje — orçamento enviado
  INSERT INTO public.excursion_requests (
    user_id, destination, excursion_date, people_count, fleet_type,
    first_aid_team, recreation_team, children_team, special_needs_team,
    recreation_items, observations, status,
    preparer_id, total_amount_cents, scheduled_departure_at,
    origin, origin_lat, origin_lng, destination_lat, destination_lng,
    budget_lines
  ) VALUES (
    client_id,
    'Alcântara (centro histórico)',
    d_today,
    28,
    'micro_onibus',
    true, false, true, false,
    '[]'::jsonb,
    'Escola — 2 professores acompanhantes.',
    'quoted',
    preparer_id,
    420000,
    (d_today + interval '6 hours 30 minutes') AT TIME ZONE 'America/Fortaleza',
    'São Luís — Aterro da Ponta da Espera',
    -2.4933, -44.3010,
    -2.4089, -44.4150,
    '[
      {"label": "Transporte ida/volta", "amount_cents": 280000},
      {"label": "Guia local", "amount_cents": 90000},
      {"label": "Seguro coletivo", "amount_cents": 50000}
    ]'::jsonb
  )
  RETURNING id INTO e_quoted;

  -- 3) Hoje — aprovada / pagamento (aba Coletas: próximas)
  INSERT INTO public.excursion_requests (
    user_id, destination, excursion_date, people_count, fleet_type,
    first_aid_team, recreation_team, children_team, special_needs_team,
    recreation_items, observations, status,
    preparer_id, total_amount_cents, scheduled_departure_at, confirmed_at,
    origin, destination_lat, destination_lng,
    payment_method, vehicle_details
  ) VALUES (
    client_id,
    'Raposa — passeio de barco',
    d_today,
    8,
    'carro',
    false, false, false, false,
    '[]'::jsonb,
    'Grupo familiar — 2 crianças.',
    'approved',
    preparer_id,
    89000,
    (d_today + interval '9 hours') AT TIME ZONE 'America/Fortaleza',
    now() - interval '2 hours',
    'São Luís — Rua da Estrela, Centro',
    -2.552, -44.090,
    'pix',
    '{"model": "Spin", "license_plate": "ABC1D23", "capacity": 7, "observation": "Ar condicionado"}'::jsonb
  )
  RETURNING id INTO e_approved;

  -- 4) Hoje — agendada (em andamento na lista Coletas)
  INSERT INTO public.excursion_requests (
    user_id, destination, excursion_date, people_count, fleet_type,
    first_aid_team, recreation_team, children_team, special_needs_team,
    recreation_items, observations, status,
    preparer_id, total_amount_cents, scheduled_departure_at, confirmed_at,
    origin, origin_lat, origin_lng, destination_lat, destination_lng
  ) VALUES (
    client_id,
    'São José de Ribamar — mirante',
    d_today,
    18,
    'van',
    false, true, false, false,
    '[]'::jsonb,
    'Kit lanche incluído pelo cliente.',
    'scheduled',
    preparer_id,
    156000,
    (d_today + interval '14 hours') AT TIME ZONE 'America/Fortaleza',
    now() - interval '1 day',
    'São Luís — Cohab Anil',
    -2.5480, -44.2150,
    -2.5619, -44.0544
  )
  RETURNING id INTO e_sched_today;

  -- 5) Hoje — em progresso + passageiros (embarques / contagens)
  INSERT INTO public.excursion_requests (
    user_id, destination, excursion_date, people_count, fleet_type,
    first_aid_team, recreation_team, children_team, special_needs_team,
    recreation_items, observations, status,
    preparer_id, total_amount_cents, scheduled_departure_at, confirmed_at,
    origin, origin_lat, origin_lng, destination_lat, destination_lng,
    assignment_notes
  ) VALUES (
    client_id,
    'Porto do Itaqui — visita técnica',
    d_today,
    6,
    'carro',
    false, false, false, false,
    '[]'::jsonb,
    'CRLV e documentos enviados por e-mail.',
    'in_progress',
    preparer_id,
    45000,
    (d_today + interval '10 hours') AT TIME ZONE 'America/Fortaleza',
    now() - interval '3 days',
    'São Luís — Praça Deodoro',
    -2.5297, -44.3028,
    -2.5525, -44.3825,
    '{"preparer_note": "Check-in portaria 15 min antes", "driver_note": null}'::jsonb
  )
  RETURNING id INTO e_progress;

  INSERT INTO public.excursion_passengers (
    excursion_request_id, full_name, cpf, phone, age, gender,
    status_departure, status_return, absence_justified
  ) VALUES
    (e_progress, 'Ana Paula Ferreira', '12345678901', '98991111111', '34', 'F', 'embarked', 'not_embarked', false),
    (e_progress, 'Bruno Costa', '98765432100', '98992222222', '29', 'M', 'not_embarked', 'not_embarked', false),
    (e_progress, 'Carla Mendes', '11122233344', '98993333333', '41', 'F', 'embarked', 'not_embarked', false);

  -- 6) Amanhã — agendada (próximas)
  INSERT INTO public.excursion_requests (
    user_id, destination, excursion_date, people_count, fleet_type,
    first_aid_team, recreation_team, children_team, special_needs_team,
    recreation_items, observations, status,
    preparer_id, total_amount_cents, scheduled_departure_at, confirmed_at,
    origin, destination_lat, destination_lng
  ) VALUES (
    client_id,
    'Bacabeira — artesanato e gastronomia',
    d_tomorrow,
    22,
    'micro_onibus',
    false, true, false, false,
    '[]'::jsonb,
    'Confirmar vaga para cadeirante (rampa).',
    'scheduled',
    preparer_id,
    310000,
    (d_tomorrow + interval '8 hours') AT TIME ZONE 'America/Fortaleza',
    now() - interval '12 hours',
    'São Luís — Terminal integrado',
    -2.857, -45.251
  )
  RETURNING id INTO e_sched_next;

  -- 7) Concluída (histórico + cronograma passado)
  INSERT INTO public.excursion_requests (
    user_id, destination, excursion_date, people_count, fleet_type,
    first_aid_team, recreation_team, children_team, special_needs_team,
    recreation_items, observations, status,
    preparer_id, total_amount_cents, scheduled_departure_at, confirmed_at,
    origin, destination_lat, destination_lng
  ) VALUES (
    client_id,
    'Morros — cachoeira',
    d_past12,
    15,
    'van',
    true, false, false, false,
    '[]'::jsonb,
    'Excursão encerrada sem ocorrências.',
    'completed',
    preparer_id,
    198000,
    (d_past12 + interval '7 hours') AT TIME ZONE 'America/Fortaleza',
    (d_today - 14 + interval '12 hours') AT TIME ZONE 'America/Fortaleza',
    'São Luís — Calhau',
    -2.840, -44.210
  )
  RETURNING id INTO e_done;

  -- 8) Cancelada
  INSERT INTO public.excursion_requests (
    user_id, destination, excursion_date, people_count, fleet_type,
    first_aid_team, recreation_team, children_team, special_needs_team,
    recreation_items, observations, status,
    preparer_id, total_amount_cents, scheduled_departure_at,
    origin, destination_lat, destination_lng
  ) VALUES (
    client_id,
    'Itapecuru-Mirim — evento cancelado pelo cliente',
    d_past3,
    40,
    'onibus',
    false, false, false, false,
    '[]'::jsonb,
    'Cliente solicitou cancelamento por chuva forte.',
    'cancelled',
    preparer_id,
    NULL,
    (d_past3 + interval '6 hours') AT TIME ZONE 'America/Fortaleza',
    'São Luís — Centro',
    -3.392, -44.358
  )
  RETURNING id INTO e_cancel;

  RAISE NOTICE 'Seed excursões OK. preparer=%, client=%, ids: pending %, quoted %, approved %, sched_today %, in_progress %, next %, done %, cancel %',
    preparer_id, client_id, e_pending, e_quoted, e_approved, e_sched_today, e_progress, e_sched_next, e_done, e_cancel;
END $$;
