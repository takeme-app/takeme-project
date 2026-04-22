-- Performance hardening (21/abr/2026): cobre os advisors
-- `unindexed_foreign_keys` (33 FKs) e `duplicate_index` (1).
--
-- CONTEXTO
-- Foreign keys sem indice de cobertura forcam sequential scans em joins
-- e em operacoes de UPDATE/DELETE na tabela referenciada (quando o PG
-- precisa validar ON DELETE/UPDATE cascade ou RESTRICT).
--
-- Todos os indices abaixo sao criados com `IF NOT EXISTS` para serem
-- idempotentes. Nomes seguem convencao `idx_<tabela>_<coluna>`, iguais
-- ao resto do projeto.
--
-- Tambem dropa o indice duplicado `idx_trip_stops_trip` (identico ao
-- `idx_trip_stops_scheduled_trip_id`). Mantemos o nome mais descritivo.

-- ── bookings ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_payment_method_id
  ON public.bookings (payment_method_id);
CREATE INDEX IF NOT EXISTS idx_bookings_pricing_route_id
  ON public.bookings (pricing_route_id);
CREATE INDEX IF NOT EXISTS idx_bookings_promotion_id
  ON public.bookings (promotion_id);

-- ── conversations ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conversations_booking_id
  ON public.conversations (booking_id);
CREATE INDEX IF NOT EXISTS idx_conversations_driver_id
  ON public.conversations (driver_id);
CREATE INDEX IF NOT EXISTS idx_conversations_support_requester_id
  ON public.conversations (support_requester_id);

-- ── dependent_shipments ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dependent_shipments_dependent_id
  ON public.dependent_shipments (dependent_id);
CREATE INDEX IF NOT EXISTS idx_dependent_shipments_payment_method_id
  ON public.dependent_shipments (payment_method_id);
CREATE INDEX IF NOT EXISTS idx_dependent_shipments_pricing_route_id
  ON public.dependent_shipments (pricing_route_id);
CREATE INDEX IF NOT EXISTS idx_dependent_shipments_promotion_id
  ON public.dependent_shipments (promotion_id);
CREATE INDEX IF NOT EXISTS idx_dependent_shipments_scheduled_trip_id
  ON public.dependent_shipments (scheduled_trip_id);

-- ── excursion_requests ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_excursion_requests_budget_created_by
  ON public.excursion_requests (budget_created_by);
CREATE INDEX IF NOT EXISTS idx_excursion_requests_driver_id
  ON public.excursion_requests (driver_id);
CREATE INDEX IF NOT EXISTS idx_excursion_requests_payment_method_id
  ON public.excursion_requests (payment_method_id);
CREATE INDEX IF NOT EXISTS idx_excursion_requests_preparer_id
  ON public.excursion_requests (preparer_id);
CREATE INDEX IF NOT EXISTS idx_excursion_requests_pricing_route_id
  ON public.excursion_requests (pricing_route_id);
CREATE INDEX IF NOT EXISTS idx_excursion_requests_promotion_id
  ON public.excursion_requests (promotion_id);

-- ── messages ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id
  ON public.messages (sender_id);

-- ── platform_settings ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_platform_settings_updated_by
  ON public.platform_settings (updated_by);

-- ── pricing_route_surcharges / pricing_routes / promotions ──────────
CREATE INDEX IF NOT EXISTS idx_pricing_route_surcharges_surcharge_id
  ON public.pricing_route_surcharges (surcharge_id);
CREATE INDEX IF NOT EXISTS idx_pricing_routes_created_by
  ON public.pricing_routes (created_by);
CREATE INDEX IF NOT EXISTS idx_promotions_created_by
  ON public.promotions (created_by);

-- ── shipments ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shipments_base_id
  ON public.shipments (base_id);
CREATE INDEX IF NOT EXISTS idx_shipments_client_preferred_driver_id
  ON public.shipments (client_preferred_driver_id);
CREATE INDEX IF NOT EXISTS idx_shipments_driver_id
  ON public.shipments (driver_id);
CREATE INDEX IF NOT EXISTS idx_shipments_payment_method_id
  ON public.shipments (payment_method_id);
CREATE INDEX IF NOT EXISTS idx_shipments_pricing_route_id
  ON public.shipments (pricing_route_id);
CREATE INDEX IF NOT EXISTS idx_shipments_promotion_id
  ON public.shipments (promotion_id);

-- ── status_history / worker_profiles / worker_ratings / worker_routes
CREATE INDEX IF NOT EXISTS idx_status_history_changed_by
  ON public.status_history (changed_by);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_base_id
  ON public.worker_profiles (base_id);
CREATE INDEX IF NOT EXISTS idx_worker_ratings_rated_by
  ON public.worker_ratings (rated_by);
CREATE INDEX IF NOT EXISTS idx_worker_routes_pricing_route_id
  ON public.worker_routes (pricing_route_id);

-- ── Duplicate index: idx_trip_stops_trip e igual a
-- idx_trip_stops_scheduled_trip_id (ambos em scheduled_trip_id).
DROP INDEX IF EXISTS public.idx_trip_stops_trip;
