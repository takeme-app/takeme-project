-- Notificações ao motorista para pedidos de envio (encomenda) e envio de dependente.
--
-- Contexto:
--   * Encomendas (public.shipments): a partir de
--     20260424200000_shipment_driver_first_then_preparer.sql, o motorista aceita
--     SEMPRE primeiro (com ou sem base). Antes disso, a notificação só era
--     disparada para envios sem base; envios com base ficavam sem push.
--     Aqui ajustamos `notify_driver_shipment_on_trip` para emitir a notificação
--     em ambos os casos (com e sem base) — a regra para o preparador continua
--     coberta pela trigger dele, que só atua após `driver_id` ser preenchido.
--
--   * Envios de dependente (public.dependent_shipments): o cliente registra
--     direto na viagem do motorista escolhido (status=pending_review,
--     scheduled_trip_id=trip do motorista). Antes desta migration, nenhuma
--     trigger notificava o motorista quando o pedido era criado / vinculado.
--     Adicionamos `notify_driver_dependent_shipment_request` cobrindo INSERT e
--     UPDATE de scheduled_trip_id (caso o vínculo seja preenchido depois).
--
-- Ambas as funções permanecem best-effort: qualquer falha secundária é
-- absorvida via `EXCEPTION WHEN OTHERS` para nunca derrubar o fluxo do cliente.

-- =====================================================================
-- 1) Encomendas: drop do guard base_id e mantém best-effort
-- =====================================================================
CREATE OR REPLACE FUNCTION public.notify_driver_shipment_on_trip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  drv uuid;
  became_linked boolean;
BEGIN
  IF NEW.scheduled_trip_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NULL OR NEW.status NOT IN ('pending_review', 'confirmed') THEN
    RETURN NEW;
  END IF;
  IF NEW.driver_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  became_linked :=
    TG_OP = 'INSERT'
    OR (TG_OP = 'UPDATE' AND (OLD.scheduled_trip_id IS DISTINCT FROM NEW.scheduled_trip_id));

  IF NOT became_linked THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT st.driver_id INTO drv
    FROM public.scheduled_trips st
    WHERE st.id = NEW.scheduled_trip_id;

    IF drv IS NULL THEN
      RETURN NEW;
    END IF;

    IF NOT public.should_notify_user(drv, 'shipments_deliveries') THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
    VALUES (
      drv,
      'Nova encomenda na sua viagem',
      'Um cliente adicionou um envio à sua rota. Veja em Solicitações pendentes.',
      'shipments_deliveries',
      'motorista',
      jsonb_build_object('route', 'PendingRequests')
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_driver_shipment_on_trip] ignorado: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_driver_shipment_on_trip() IS
  'Best-effort: notifica o motorista da scheduled_trip quando um shipment é vinculado ou criado em pending_review/confirmed (com ou sem base). Não bloqueia inserts.';

-- =====================================================================
-- 2) Envios de dependente: trigger nova
-- =====================================================================
CREATE OR REPLACE FUNCTION public.notify_driver_dependent_shipment_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  drv uuid;
  became_linked boolean;
BEGIN
  IF NEW.scheduled_trip_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NULL OR NEW.status NOT IN ('pending_review', 'confirmed') THEN
    RETURN NEW;
  END IF;

  became_linked :=
    TG_OP = 'INSERT'
    OR (TG_OP = 'UPDATE' AND (OLD.scheduled_trip_id IS DISTINCT FROM NEW.scheduled_trip_id));

  IF NOT became_linked THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT st.driver_id INTO drv
    FROM public.scheduled_trips st
    WHERE st.id = NEW.scheduled_trip_id;

    IF drv IS NULL THEN
      RETURN NEW;
    END IF;

    IF NOT public.should_notify_user(drv, 'shipments_deliveries') THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
    VALUES (
      drv,
      'Novo envio de dependente na sua viagem',
      'Um cliente solicitou um envio de dependente para sua rota. Veja em Solicitações pendentes.',
      'shipments_deliveries',
      'motorista',
      jsonb_build_object('route', 'PendingRequests')
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_driver_dependent_shipment_request] ignorado: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_driver_dependent_shipment_request() IS
  'Best-effort: notifica o motorista da scheduled_trip quando um envio de dependente é criado ou tem o vínculo preenchido em pending_review/confirmed.';

DROP TRIGGER IF EXISTS on_dependent_shipment_trip_notify_driver ON public.dependent_shipments;
CREATE TRIGGER on_dependent_shipment_trip_notify_driver
  AFTER INSERT OR UPDATE OF scheduled_trip_id, status ON public.dependent_shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_dependent_shipment_request();
