-- Abre a fila sequencial de motoristas **no próprio banco** assim que um envio fica
-- elegível (confirmed/pending_review, sem base, com motorista preferido, sem driver_id
-- atribuído, fila ainda não iniciada, pagamento online com PaymentIntent quando exigido).
--
-- Regra de negócio (referência):
--   - Com base (shipments.base_id NOT NULL): preparador é responsável; não se abre fila.
--   - Sem base: fila sequencial começa pelo motorista preferido escolhido pelo cliente.
--
-- Motivo da migration: o app cliente chama a RPC pública `shipment_begin_driver_offering`
-- no ConfirmShipmentScreen, mas só para dinheiro/grande; para cartão/Pix a RPC devolve
-- `payment_required` e ninguém a chama depois do webhook. Também há janelas em que o
-- cliente grava `client_preferred_driver_id` mas falha em disparar a RPC (rede, erro
-- silencioso). Resultado: envios ficam com `current_offer_driver_id` NULL e o motorista
-- preferido nunca vê a solicitação. Trazer a abertura da fila para o banco elimina
-- todas essas janelas, pois o próprio trigger reavalia em cada mudança relevante.

-- ---------------------------------------------------------------------------
-- 1) Helper interno (sem barreira auth.uid()) — mesma lógica da RPC pública,
--    mas pensado para ser chamado por trigger do banco.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shipment_open_driver_offer_queue_internal(
  p_shipment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.shipments%ROWTYPE;
  q uuid[] := '{}';
  q_ordered uuid[] := '{}';
  d uuid;
  pref uuid;
  r record;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Guardas de elegibilidade (mesmas semânticas da RPC pública).
  IF s.driver_id IS NOT NULL THEN RETURN; END IF;
  IF s.driver_offer_index IS NOT NULL AND s.driver_offer_index >= 0 THEN RETURN; END IF;
  IF s.base_id IS NOT NULL THEN RETURN; END IF;
  IF s.client_preferred_driver_id IS NULL THEN RETURN; END IF;
  IF s.status IS NULL OR s.status NOT IN ('pending_review', 'confirmed') THEN RETURN; END IF;

  -- Pagamento online ainda não confirmado: não abre fila até o webhook gravar o PI.
  IF lower(coalesce(s.payment_method, '')) IN ('credito', 'debito', 'pix')
     AND (s.stripe_payment_intent_id IS NULL OR btrim(s.stripe_payment_intent_id) = '')
  THEN
    RETURN;
  END IF;

  pref := s.client_preferred_driver_id;

  FOR r IN
    SELECT st.driver_id, st.departure_at, coalesce(st.badge, '') AS badge
    FROM public.scheduled_trips st
    WHERE st.status = 'active'
      AND st.is_active IS TRUE
      AND st.driver_journey_started_at IS NULL
      AND st.departure_at > now()
      AND st.seats_available > 0
      AND public.shipment_same_route_as_trip(
        s.origin_lat, s.origin_lng, s.destination_lat, s.destination_lng,
        st.origin_lat, st.origin_lng, st.destination_lat, st.destination_lng
      )
    ORDER BY st.departure_at ASC,
      CASE WHEN coalesce(st.badge, '') = 'Take Me' THEN 0 ELSE 1 END ASC
  LOOP
    IF NOT (r.driver_id = ANY (q)) THEN
      q := array_append(q, r.driver_id);
    END IF;
  END LOOP;

  IF coalesce(array_length(q, 1), 0) = 0 THEN
    UPDATE public.shipments
    SET
      status = 'cancelled',
      cancellation_reason = 'no_driver_accepted',
      current_offer_driver_id = NULL,
      current_offer_expires_at = NULL,
      driver_offer_queue = '{}',
      driver_offer_index = -1
    WHERE id = p_shipment_id;
    RETURN;
  END IF;

  q_ordered := array_append(q_ordered, pref);
  FOREACH d IN ARRAY q LOOP
    IF d IS DISTINCT FROM pref THEN
      q_ordered := array_append(q_ordered, d);
    END IF;
  END LOOP;
  q := q_ordered;

  UPDATE public.shipments
  SET
    driver_offer_queue = q,
    driver_offer_index = 0,
    current_offer_driver_id = q[1],
    current_offer_expires_at = now() + interval '30 minutes'
  WHERE id = p_shipment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.shipment_open_driver_offer_queue_internal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shipment_open_driver_offer_queue_internal(uuid) TO service_role;

COMMENT ON FUNCTION public.shipment_open_driver_offer_queue_internal(uuid) IS
  'Helper de trigger: abre a fila sequencial de motoristas se o envio está elegível. Sem barreira auth.uid().';

-- ---------------------------------------------------------------------------
-- 2) Trigger function — decide se chama o helper em cada mudança relevante.
--    Proteção contra recursão: o próprio helper sai em `driver_offer_index >= 0`
--    e em `status NOT IN (...)`, de modo que o UPDATE que ele realiza dispara
--    o trigger uma segunda vez mas encerra imediatamente.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_shipment_auto_open_driver_offer_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.base_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.client_preferred_driver_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.driver_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.driver_offer_index IS NOT NULL AND NEW.driver_offer_index >= 0 THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NULL OR NEW.status NOT IN ('pending_review', 'confirmed') THEN
    RETURN NEW;
  END IF;

  IF lower(coalesce(NEW.payment_method, '')) IN ('credito', 'debito', 'pix')
     AND (NEW.stripe_payment_intent_id IS NULL OR btrim(NEW.stripe_payment_intent_id) = '')
  THEN
    RETURN NEW;
  END IF;

  -- Só chama em transições — evita trabalho repetido em UPDATEs que não mexeram
  -- em nada relevante (ex.: updated_at).
  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND (
          OLD.status IS DISTINCT FROM NEW.status
          OR OLD.stripe_payment_intent_id IS DISTINCT FROM NEW.stripe_payment_intent_id
          OR OLD.client_preferred_driver_id IS DISTINCT FROM NEW.client_preferred_driver_id
          OR OLD.base_id IS DISTINCT FROM NEW.base_id
          OR OLD.driver_offer_index IS DISTINCT FROM NEW.driver_offer_index
     ))
  THEN
    BEGIN
      PERFORM public.shipment_open_driver_offer_queue_internal(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[trg_shipment_auto_open_driver_offer_queue] ignorado: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_shipment_auto_open_driver_offer_queue() IS
  'Best-effort: qualquer falha no helper não pode abortar o INSERT/UPDATE em shipments.';

DROP TRIGGER IF EXISTS on_shipment_auto_open_driver_offer_queue ON public.shipments;
CREATE TRIGGER on_shipment_auto_open_driver_offer_queue
  AFTER INSERT OR UPDATE OF
    status,
    stripe_payment_intent_id,
    client_preferred_driver_id,
    base_id,
    driver_offer_index
  ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_shipment_auto_open_driver_offer_queue();

-- ---------------------------------------------------------------------------
-- 3) Backfill: envios que já estão no estado órfão precisam ter a fila aberta
--    agora (sem esperar um novo UPDATE). Só tenta nos que são seguramente
--    elegíveis — o helper, por garantia, revalida cada guard.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  shp uuid;
BEGIN
  FOR shp IN
    SELECT id
    FROM public.shipments
    WHERE driver_id IS NULL
      AND (driver_offer_index IS NULL OR driver_offer_index < 0)
      AND base_id IS NULL
      AND client_preferred_driver_id IS NOT NULL
      AND status IN ('pending_review', 'confirmed')
      AND (
        lower(coalesce(payment_method, '')) NOT IN ('credito', 'debito', 'pix')
        OR (stripe_payment_intent_id IS NOT NULL AND btrim(stripe_payment_intent_id) <> '')
      )
  LOOP
    BEGIN
      PERFORM public.shipment_open_driver_offer_queue_internal(shp);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[backfill shipment_open_driver_offer_queue_internal] % : %', shp, SQLERRM;
    END;
  END LOOP;
END $$;
