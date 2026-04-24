-- =============================================================================
-- Cancellation policy + driver penalties
-- =============================================================================
-- Substitui o fluxo legado onde o cancelamento era um UPDATE silencioso em
-- bookings/scheduled_trips sem estorno. Agora:
--   1. bookings ganha colunas de auditoria do cancelamento (who/when/policy).
--   2. platform_settings expõe a janela de reembolso integral + multa motorista.
--   3. driver_penalties registra cobranças devidas ao motorista (cancelamento
--      com passageiros já pagos), aplicadas no próximo payout.
--   4. Trigger sync_bookings_when_scheduled_trip_cancelled agora marca cancelled_by
--      e cancellation_reason nas reservas propagadas.
-- =============================================================================

-- ── Colunas de auditoria em bookings ──────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_by text NULL
    CHECK (cancelled_by IS NULL OR cancelled_by IN ('passenger', 'driver', 'admin', 'system')),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS cancellation_policy_applied jsonb NULL,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS refund_amount_cents integer NULL;

COMMENT ON COLUMN public.bookings.cancelled_by IS
  'Papel que originou o cancelamento (passenger/driver/admin/system).';
COMMENT ON COLUMN public.bookings.cancelled_at IS
  'Timestamp do cancelamento efetivo.';
COMMENT ON COLUMN public.bookings.cancellation_policy_applied IS
  'Snapshot JSON da política vigente no momento (horas threshold, dentro/fora da janela, valor reembolsado).';
COMMENT ON COLUMN public.bookings.refunded_at IS
  'Timestamp do refund Stripe confirmado (via webhook charge.refunded).';
COMMENT ON COLUMN public.bookings.refund_amount_cents IS
  'Valor efetivamente estornado ao passageiro (cents).';

-- ── Seeds de platform_settings ────────────────────────────────────────────────
INSERT INTO public.platform_settings (key, value)
VALUES
  ('booking_cancellation_free_window_hours', jsonb_build_object('value', 2)),
  ('driver_cancellation_penalty_pct', jsonb_build_object('value', 10)),
  ('driver_cancellation_penalty_enabled', jsonb_build_object('value', true))
ON CONFLICT (key) DO NOTHING;

-- ── Tabela driver_penalties ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.driver_penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_trip_id uuid NULL REFERENCES public.scheduled_trips(id) ON DELETE SET NULL,
  booking_id uuid NULL REFERENCES public.bookings(id) ON DELETE SET NULL,
  reason text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'applied', 'waived', 'cancelled')),
  applied_at timestamptz NULL,
  applied_payout_id uuid NULL REFERENCES public.payouts(id) ON DELETE SET NULL,
  waived_at timestamptz NULL,
  waived_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  waived_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_penalties_driver_status
  ON public.driver_penalties(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_driver_penalties_scheduled_trip
  ON public.driver_penalties(scheduled_trip_id);
CREATE INDEX IF NOT EXISTS idx_driver_penalties_booking
  ON public.driver_penalties(booking_id);

COMMENT ON TABLE public.driver_penalties IS
  'Multas devidas por motoristas (ex.: cancelamento com passageiros já pagos). Aplicadas em process-payouts.';
COMMENT ON COLUMN public.driver_penalties.reason IS
  'Código da razão: ex. driver_cancelled_after_payment.';
COMMENT ON COLUMN public.driver_penalties.amount_cents IS
  'Valor da multa em centavos (sempre positivo; será deduzido do payout).';

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.driver_penalties_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_driver_penalties_touch_updated_at ON public.driver_penalties;
CREATE TRIGGER trg_driver_penalties_touch_updated_at
  BEFORE UPDATE ON public.driver_penalties
  FOR EACH ROW
  EXECUTE FUNCTION public.driver_penalties_touch_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.driver_penalties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access driver_penalties" ON public.driver_penalties;
CREATE POLICY "Admins full access driver_penalties"
  ON public.driver_penalties
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Drivers read own penalties" ON public.driver_penalties;
CREATE POLICY "Drivers read own penalties"
  ON public.driver_penalties
  FOR SELECT
  USING (driver_id = auth.uid());

-- ── Trigger atualizado: sync_bookings_when_scheduled_trip_cancelled ───────────
-- Agora marca cancelled_by='driver' e cancellation_reason='driver_cancelled_scheduled_trip'
-- nas reservas propagadas (para auditoria + diferenciar do cancelamento do passageiro).
CREATE OR REPLACE FUNCTION public.sync_bookings_when_scheduled_trip_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  UPDATE public.bookings
  SET
    status = 'cancelled',
    cancelled_by = COALESCE(cancelled_by, 'driver'),
    cancelled_at = COALESCE(cancelled_at, now()),
    cancellation_reason = COALESCE(cancellation_reason, 'driver_cancelled_scheduled_trip'),
    updated_at = now()
  WHERE scheduled_trip_id = NEW.id
    AND status = ANY (ARRAY['pending'::text, 'paid'::text, 'confirmed'::text]);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_bookings_when_scheduled_trip_cancelled() IS
  'Ao cancelar scheduled_trips, cancela reservas pending/paid/confirmed vinculadas e grava cancelled_by=driver para auditoria.';
