-- =====================================================================
-- Shipments: colunas de tracking do preparador de encomendas (Fase 7).
--
-- O preparador de encomendas (worker_profiles.role='preparer',
-- subtype='shipments') hoje é implícito pela `base_id` comum entre
-- `shipments` e `worker_profiles`. Esta migration introduz, sem quebrar
-- nada, o necessário para notificações dedicadas:
--
--   * `preparer_id` — FK opcional para o auth.users do preparador que
--     "assumiu" a encomenda (preenchido pelo app em evolução futura).
--   * Quatro timestamps idempotentes que sinalizam cada fase operacional
--     do preparador de encomendas (ver spec, Fase 7):
--       preparer_pickup_started_at   -> "Você está indo coletar o pacote"
--       preparer_arrived_at_client_at-> "Você chegou ao cliente!"
--       preparer_to_base_started_at  -> "Indo para a base"
--       preparer_arrived_at_base_at  -> "Você chegou a base, entregue o pacote."
--
-- Cada timestamp é preenchido (UPDATE NULL -> NOT NULL) pelo app do
-- preparador durante o fluxo; o trigger dedicado (migration seguinte)
-- dispara a notificação ao `preparer_id` correspondente.
-- =====================================================================

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS preparer_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preparer_pickup_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS preparer_arrived_at_client_at timestamptz,
  ADD COLUMN IF NOT EXISTS preparer_to_base_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS preparer_arrived_at_base_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_shipments_preparer_id
  ON public.shipments (preparer_id)
  WHERE preparer_id IS NOT NULL;

COMMENT ON COLUMN public.shipments.preparer_id IS
  'Preparador de encomendas que assumiu a coleta. Usado para notificações dedicadas (Fase 7).';
COMMENT ON COLUMN public.shipments.preparer_pickup_started_at IS
  'Momento em que o preparador iniciou a jornada de coleta; dispara "Você está indo coletar o pacote".';
COMMENT ON COLUMN public.shipments.preparer_arrived_at_client_at IS
  'Momento em que o preparador chegou ao cliente; dispara "Você chegou ao cliente!".';
COMMENT ON COLUMN public.shipments.preparer_to_base_started_at IS
  'Momento em que o preparador iniciou a volta para a base; dispara "Indo para a base".';
COMMENT ON COLUMN public.shipments.preparer_arrived_at_base_at IS
  'Momento em que o preparador chegou à base; dispara "Você chegou a base, entregue o pacote.".';
