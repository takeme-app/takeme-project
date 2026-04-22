-- Flip das 7 views de SECURITY DEFINER (default do Postgres 15+ quando
-- security_invoker nao esta setado) para security_invoker=true.
--
-- CONTEXTO
-- Essas views foram criadas por migrations antigas
-- (20260329120000_admin_views, 20250331000000_create_chat_tables) sem a
-- opcao explicita WITH (security_invoker = true). Como a Postgres 15+
-- default e security_invoker=false, as views rodavam com as permissoes do
-- dono (postgres), ignorando RLS do caller. O advisor security_definer_view
-- apontava os 7 casos.
--
-- CALLERS
-- Nenhuma view e consumida diretamente pelo codigo dos apps (grep em
-- apps/ + supabase/functions/ retornou zero matches fora de docs/PRDs).
-- Sao artefatos de schema documentados no PRD para queries ad-hoc via
-- Studio/SQL. Flipar para security_invoker=true preserva esse uso quando
-- o caller e admin (policies is_admin/is_admin_v2 cobrem as base tables:
-- bookings, shipments, dependent_shipments, excursion_requests,
-- worker_profiles, profiles, payouts, promotions, scheduled_trips,
-- conversations, excursion_passengers, worker_ratings, bases).
--
-- EFEITO
-- - Admin UI e queries ad-hoc com sessao admin continuam lendo normalmente.
-- - driver_conversations: motorista passa a ler via conversations_select
--   (policy ja existente: auth.uid() = driver_id OR client_id OR
--   support_requester_id).
-- - Usuarios nao autorizados que tentarem ler recebem 0 linhas (em vez
--   de dados vazarem via SECURITY DEFINER).

ALTER VIEW public.admin_dashboard_stats SET (security_invoker = true);
ALTER VIEW public.admin_destinos_overview SET (security_invoker = true);
ALTER VIEW public.admin_encomenda_stats SET (security_invoker = true);
ALTER VIEW public.admin_passenger_demographics SET (security_invoker = true);
ALTER VIEW public.admin_promotion_adhesion SET (security_invoker = true);
ALTER VIEW public.admin_worker_overview SET (security_invoker = true);
ALTER VIEW public.driver_conversations SET (security_invoker = true);
