-- =============================================================================
-- supabase/scripts/reset-auth-keep-admin.sql
-- Reset do banco de dados Take Me: apaga TODAS as contas de Auth exceto
-- admin@takeme.com e todos os dados dependentes via CASCADE. Preserva schema
-- (tabelas, funções, triggers, RLS) e catálogos não ligados a usuários
-- (ex.: takeme_routes, bases, pricing_routes, promotions, platform_settings).
--
-- AMBIENTE: dev / staging. NÃO rodar em produção sem backup.
-- AUTOR: agente (via plano "Reset DB keep admin").
--
-- RESTRIÇÕES:
--   * Apenas DML (DELETE / UPDATE / SELECT) + transação. SEM DROP, ALTER,
--     TRUNCATE, CREATE ou CREATE OR REPLACE. Schema e funções permanecem.
--
-- ORDEM DE USO VIA MCP (server: user-supabase-takeme):
--   1) list_tables  { schemas: ["public","auth"], verbose: true }
--      -> confirma que nenhuma migration nova introduziu FK `NO ACTION`
--         para auth.users além das tratadas abaixo.
--   2) execute_sql  (bloco "DRY RUN" — só SELECTs de contagem)
--   3) execute_sql  (bloco "APPLY" — BEGIN ... COMMIT)
--   4) execute_sql  (bloco "VERIFY" — contagens pós-execução)
--
-- FKs NO ACTION / RESTRICT que bloqueiam DELETE em cascata
-- (validado em 2026-04-23 via pg_constraint):
--
--   (a) NO ACTION para auth.users -> UPDATE colunas para NULL:
--       - shipments.driver_id, shipments.client_preferred_driver_id,
--         shipments.current_offer_driver_id
--       - conversations.admin_id
--       - platform_settings.updated_by
--
--   (b) NO ACTION / RESTRICT para tabelas public -> DELETE explícito
--       antes do DELETE em auth.users, na ordem correta:
--       - payouts.worker_id              -> worker_profiles (RESTRICT)
--       - worker_assignments.worker_id   -> worker_profiles (RESTRICT)
--       - bookings.scheduled_trip_id     -> scheduled_trips (RESTRICT)
--       - shipments.scheduled_trip_id    -> scheduled_trips (NO ACTION)
--       - dependent_shipments.scheduled_trip_id -> scheduled_trips (NO ACTION)
--
-- Demais FKs para auth.users e para tabelas public são CASCADE ou SET NULL.
--
-- CATÁLOGOS PRESERVADOS (sem FK direta a auth.users):
--   takeme_routes, pricing_routes (FK SET NULL em created_by),
--   promotions, platform_settings, bases, vehicles (via worker_profiles),
--   worker_routes (via worker_profiles), etc. Conteúdo desses catálogos
--   continua após o reset.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- [0] DRY RUN (opcional) — rode isoladamente antes do bloco APPLY
-- -----------------------------------------------------------------------------
-- select count(*) as total_users, count(*) filter (where lower(trim(email)) = 'admin@takeme.com') as admins from auth.users;
-- select count(*) as shipments_total, count(*) filter (where driver_id is not null) as with_driver from public.shipments;
-- select count(*) from public.email_verification_codes;

-- =============================================================================
-- [1] APPLY — transação única
-- =============================================================================
begin;

-- [1.1] Guarda: existe exatamente 1 usuário admin@takeme.com
do $$
declare
  v_admin_count int;
  v_admin_id uuid;
begin
  select count(*) into v_admin_count
  from auth.users
  where lower(trim(coalesce(email, ''))) = 'admin@takeme.com';

  if v_admin_count <> 1 then
    raise exception
      'Abortando: esperava 1 usuário com email admin@takeme.com, encontrei %. Ajuste o e-mail ou a conta antes de rodar o script.',
      v_admin_count;
  end if;

  select id into v_admin_id
  from auth.users
  where lower(trim(coalesce(email, ''))) = 'admin@takeme.com'
  limit 1;

  raise notice 'Admin preservado: id=% (email=admin@takeme.com)', v_admin_id;
end
$$;

-- [1.2] Neutralizar FKs NO ACTION em shipments (driver_id,
--       client_preferred_driver_id, current_offer_driver_id) e limpar
--       dados de fila/oferta para estado consistente.
update public.shipments
   set driver_id                  = null,
       client_preferred_driver_id = null,
       current_offer_driver_id    = null,
       current_offer_expires_at   = null,
       driver_offer_queue         = null,
       driver_offer_index         = -1
 where driver_id                  is not null
    or client_preferred_driver_id is not null
    or current_offer_driver_id    is not null
    or driver_offer_queue         is not null;

-- [1.3] Neutralizar FK NO ACTION em conversations.admin_id quando apontar
--       para um usuário que será apagado.
update public.conversations
   set admin_id = null
 where admin_id is not null
   and admin_id not in (
     select id from auth.users
     where lower(trim(coalesce(email, ''))) = 'admin@takeme.com'
   );

-- [1.4] Neutralizar FK NO ACTION em platform_settings.updated_by.
update public.platform_settings
   set updated_by = null
 where updated_by is not null
   and updated_by not in (
     select id from auth.users
     where lower(trim(coalesce(email, ''))) = 'admin@takeme.com'
   );

-- [1.5] Apagar tabelas com FKs RESTRICT / NO ACTION para tabelas public, em
--       ordem segura de dependências. Sem isso, a cascata originada pelo
--       DELETE em auth.users é bloqueada (ex.: payouts_worker_id_fkey,
--       bookings_scheduled_trip_id_fkey).
delete from public.payouts;
delete from public.worker_assignments;
delete from public.bookings;
delete from public.shipments;
delete from public.dependent_shipments;
delete from public.scheduled_trips;

-- [1.6] Limpar email_verification_codes (tabela sem FK para auth.users).
--       Todos os códigos são temporários; não há motivo para preservar após reset.
delete from public.email_verification_codes;

-- [1.7] Remover todos os usuários exceto admin@takeme.com. Cascata apaga:
--       profiles, worker_profiles (+ vehicles, worker_routes), excursion_requests
--       (pelo user_id), dependents, notifications, notification_preferences,
--       payment_methods, user_preferences, recent_destinations, data_export_requests,
--       conversations (client_id/driver_id), messages, worker_ratings,
--       trip_ratings, worker_weekly_price_adjustments, promotion_adhesions,
--       auth.identities, auth.sessions, auth.mfa_factors, auth.one_time_tokens,
--       auth.oauth_authorizations, auth.oauth_consents, auth.webauthn_* etc.
--       (bookings, shipments, dependent_shipments, scheduled_trips, payouts e
--        worker_assignments já foram apagados no passo [1.5].)
delete from auth.users
 where lower(trim(coalesce(email, ''))) <> 'admin@takeme.com';

commit;

-- =============================================================================
-- [2] VERIFY — rode após o COMMIT
-- =============================================================================
-- select count(*) as auth_users_remaining from auth.users;                        -- esperado: 1
-- select email from auth.users;                                                   -- esperado: admin@takeme.com
-- select count(*) as profiles_remaining from public.profiles;                     -- esperado: 1 (o admin)
-- select count(*) as worker_profiles_remaining from public.worker_profiles;       -- esperado: 0 ou 1 (se admin for worker)
-- select count(*) as shipments_remaining from public.shipments;                   -- esperado: 0
-- select count(*) as bookings_remaining from public.bookings;                     -- esperado: 0
-- select count(*) as dependent_shipments_remaining from public.dependent_shipments; -- esperado: 0
-- select count(*) as excursion_requests_remaining from public.excursion_requests; -- esperado: 0
-- select count(*) as scheduled_trips_remaining from public.scheduled_trips;       -- esperado: 0
-- select count(*) as conversations_remaining from public.conversations;           -- esperado: 0
-- select count(*) as notifications_remaining from public.notifications;           -- esperado: 0 ou só do admin
-- select count(*) as payouts_remaining from public.payouts;                       -- esperado: 0
-- select count(*) as worker_assignments_remaining from public.worker_assignments; -- esperado: 0
-- select count(*) as takeme_routes_remaining from public.takeme_routes;           -- esperado: igual ao antes (catálogo preservado)
