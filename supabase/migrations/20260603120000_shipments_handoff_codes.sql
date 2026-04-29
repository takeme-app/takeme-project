-- =============================================================================
-- Cenário 3 (PDF "Sequência de Solicitação de Código"): Encomenda COM base.
-- O fluxo prevê 4 handoffs validados por PIN:
--   PIN A — Passageiro → Preparador      (etapas 1-3)
--   PIN B — Preparador → Base            (etapas 6-8)
--   PIN C — Base → Motorista             (etapas 10-11)
--   PIN D — Motorista → Destinatário     (etapas 14-17, já existe = delivery_code)
--
-- Esta migration adiciona apenas as colunas e timestamps. A geração e a
-- validação ficam em migrations subsequentes.
--
-- Encomenda SEM base mantém o modelo atual (pickup_code + delivery_code).
-- =============================================================================

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS passenger_to_preparer_code text,
  ADD COLUMN IF NOT EXISTS preparer_to_base_code text,
  ADD COLUMN IF NOT EXISTS base_to_driver_code text,
  ADD COLUMN IF NOT EXISTS picked_up_by_preparer_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_to_base_at timestamptz,
  ADD COLUMN IF NOT EXISTS picked_up_by_driver_from_base_at timestamptz;

COMMENT ON COLUMN public.shipments.passenger_to_preparer_code IS
  'PIN A (cenário 3 do PDF): preparador informa ao passageiro na coleta. Passageiro valida.';
COMMENT ON COLUMN public.shipments.preparer_to_base_code IS
  'PIN B (cenário 3 do PDF): base informa ao preparador na entrega na base. Preparador valida.';
COMMENT ON COLUMN public.shipments.base_to_driver_code IS
  'PIN C (cenário 3 do PDF): motorista informa à base na retirada. Base valida.';
COMMENT ON COLUMN public.shipments.picked_up_by_preparer_at IS
  'Timestamp do handoff Passageiro → Preparador (após validar PIN A).';
COMMENT ON COLUMN public.shipments.delivered_to_base_at IS
  'Timestamp do handoff Preparador → Base (após validar PIN B).';
COMMENT ON COLUMN public.shipments.picked_up_by_driver_from_base_at IS
  'Timestamp do handoff Base → Motorista (após validar PIN C).';

-- =============================================================================
-- Geração automática dos PINs.
--
-- Função antiga `generate_shipment_codes` era compartilhada entre `shipments`
-- e `dependent_shipments`. Separamos para isolar a lógica de base.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_shipment_codes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  used text[];
BEGIN
  IF NEW.pickup_code IS NULL OR btrim(NEW.pickup_code) = '' THEN
    NEW.pickup_code := public.generate_4digit_code();
  END IF;
  used := ARRAY[NEW.pickup_code];

  IF NEW.delivery_code IS NULL OR btrim(NEW.delivery_code) = '' THEN
    NEW.delivery_code := public.generate_4digit_code();
    WHILE NEW.delivery_code = ANY (used) LOOP
      NEW.delivery_code := public.generate_4digit_code();
    END LOOP;
  END IF;
  used := used || NEW.delivery_code;

  -- Encomenda com base: gera 3 PINs adicionais para os handoffs A, B e C.
  IF NEW.base_id IS NOT NULL THEN
    IF NEW.passenger_to_preparer_code IS NULL OR btrim(NEW.passenger_to_preparer_code) = '' THEN
      NEW.passenger_to_preparer_code := public.generate_4digit_code();
      WHILE NEW.passenger_to_preparer_code = ANY (used) LOOP
        NEW.passenger_to_preparer_code := public.generate_4digit_code();
      END LOOP;
    END IF;
    used := used || NEW.passenger_to_preparer_code;

    IF NEW.preparer_to_base_code IS NULL OR btrim(NEW.preparer_to_base_code) = '' THEN
      NEW.preparer_to_base_code := public.generate_4digit_code();
      WHILE NEW.preparer_to_base_code = ANY (used) LOOP
        NEW.preparer_to_base_code := public.generate_4digit_code();
      END LOOP;
    END IF;
    used := used || NEW.preparer_to_base_code;

    IF NEW.base_to_driver_code IS NULL OR btrim(NEW.base_to_driver_code) = '' THEN
      NEW.base_to_driver_code := public.generate_4digit_code();
      WHILE NEW.base_to_driver_code = ANY (used) LOOP
        NEW.base_to_driver_code := public.generate_4digit_code();
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.generate_shipment_codes() IS
  'Gera PINs de shipments. Encomenda sem base: pickup_code + delivery_code. Encomenda com base: + passenger_to_preparer_code, preparer_to_base_code, base_to_driver_code (cenário 3 do PDF).';

-- A função compartilhada anterior gerava só 2 PINs e era usada também por
-- dependent_shipments via trigger. Recriamos uma função dedicada para
-- dependent_shipments para preservar o comportamento original lá.

CREATE OR REPLACE FUNCTION public.generate_dependent_shipment_codes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pickup_code IS NULL OR btrim(NEW.pickup_code) = '' THEN
    NEW.pickup_code := public.generate_4digit_code();
  END IF;
  IF NEW.delivery_code IS NULL OR btrim(NEW.delivery_code) = '' THEN
    NEW.delivery_code := public.generate_4digit_code();
  END IF;
  WHILE NEW.delivery_code IS NOT DISTINCT FROM NEW.pickup_code LOOP
    NEW.delivery_code := public.generate_4digit_code();
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dependent_shipments_generate_codes ON public.dependent_shipments;
CREATE TRIGGER trg_dependent_shipments_generate_codes
  BEFORE INSERT ON public.dependent_shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_dependent_shipment_codes();

-- =============================================================================
-- Backfill: shipments com base já existentes que não têm os 3 novos PINs.
-- =============================================================================

DO $$
DECLARE
  r RECORD;
  c1 text;
  c2 text;
  c3 text;
  used text[];
BEGIN
  FOR r IN
    SELECT id, pickup_code, delivery_code
    FROM public.shipments
    WHERE base_id IS NOT NULL
      AND (
        passenger_to_preparer_code IS NULL
        OR preparer_to_base_code IS NULL
        OR base_to_driver_code IS NULL
      )
  LOOP
    used := ARRAY[
      coalesce(r.pickup_code, ''),
      coalesce(r.delivery_code, '')
    ];

    c1 := public.generate_4digit_code();
    WHILE c1 = ANY (used) LOOP
      c1 := public.generate_4digit_code();
    END LOOP;
    used := used || c1;

    c2 := public.generate_4digit_code();
    WHILE c2 = ANY (used) LOOP
      c2 := public.generate_4digit_code();
    END LOOP;
    used := used || c2;

    c3 := public.generate_4digit_code();
    WHILE c3 = ANY (used) LOOP
      c3 := public.generate_4digit_code();
    END LOOP;

    UPDATE public.shipments
    SET
      passenger_to_preparer_code = coalesce(passenger_to_preparer_code, c1),
      preparer_to_base_code      = coalesce(preparer_to_base_code, c2),
      base_to_driver_code        = coalesce(base_to_driver_code, c3),
      updated_at                 = now()
    WHERE id = r.id;
  END LOOP;
END;
$$;
