-- Reforça os caminhos de notificação ao motorista para envios (encomenda + dependente).
--
-- Motivação:
--   A migration 20260603160000 cobre INSERT/UPDATE de scheduled_trip_id em
--   shipments/dependent_shipments. Mas em produção observamos que envios em
--   cidades com base nascem com `scheduled_trip_id` NULL e o motorista é
--   selecionado pela fila sequencial, via `current_offer_driver_id`. Também
--   há fluxos onde `driver_id` aparece preenchido sem que a fila/oferta
--   tenha gerado push. Isto é, dependendo do caminho exato (auto-accept,
--   preparer-first invertido, etc.), o trigger anterior não dispara.
--
--   Esta migration adiciona dois caminhos de fallback de notificação:
--     1) Quando `current_offer_driver_id` passa de NULL → motorista X.
--     2) Quando `driver_id` passa de NULL → motorista X (auto-accept).
--
--   Ambas funções permanecem best-effort (EXCEPTION WHEN OTHERS) e não
--   geram push duplicado quando o trigger anterior já notificou: usamos a
--   chave de colapso/tag (`fcm_collapse_key`) por shipment_id, garantindo
--   que o Notifee/FCM mantenha apenas a última.
--
-- Compatível com:
--   * Trigger 20260603160000 (que cobre o INSERT com scheduled_trip_id).
--   * `notify_driver_activity_status_changed` (UPDATE OF status) — esse
--     continua emitindo o "Sua atividade mudou de status".

-- =====================================================================
-- 1) Encomendas: notificar quando o motorista é setado por OFERTA
-- =====================================================================
CREATE OR REPLACE FUNCTION public.notify_driver_shipment_offer_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  drv uuid;
BEGIN
  -- Caminho A: oferta foi atribuída a um motorista (current_offer_driver_id passou de NULL → X)
  IF TG_OP = 'UPDATE'
     AND OLD.current_offer_driver_id IS DISTINCT FROM NEW.current_offer_driver_id
     AND NEW.current_offer_driver_id IS NOT NULL
  THEN
    drv := NEW.current_offer_driver_id;

  -- Caminho B: driver_id passou de NULL → X (auto-accept, atribuição direta)
  ELSIF TG_OP = 'UPDATE'
        AND OLD.driver_id IS NULL
        AND NEW.driver_id IS NOT NULL
  THEN
    drv := NEW.driver_id;

  -- Caminho C: insert direto com driver_id já preenchido
  ELSIF TG_OP = 'INSERT' AND NEW.driver_id IS NOT NULL THEN
    drv := NEW.driver_id;

  ELSE
    RETURN NEW;
  END IF;

  IF NEW.status IS NULL OR NEW.status NOT IN ('pending_review', 'confirmed') THEN
    RETURN NEW;
  END IF;

  BEGIN
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
      'Um cliente solicitou um envio na sua rota. Veja em Solicitações pendentes.',
      'shipments_deliveries',
      'motorista',
      jsonb_build_object(
        'route', 'PendingRequests',
        'shipment_id', NEW.id,
        'fcm_collapse_key', 'shipment_request_' || NEW.id::text,
        'fcm_android_tag', 'shipment_request_' || NEW.id::text
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_driver_shipment_offer_assigned] ignorado: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_driver_shipment_offer_assigned() IS
  'Best-effort: notifica o motorista quando current_offer_driver_id ou driver_id é preenchido em shipments. Cobre cenários onde scheduled_trip_id é NULL (envios com base, auto-accept).';

DROP TRIGGER IF EXISTS on_shipment_offer_assigned_notify_driver ON public.shipments;
CREATE TRIGGER on_shipment_offer_assigned_notify_driver
  AFTER INSERT OR UPDATE OF current_offer_driver_id, driver_id, status ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_shipment_offer_assigned();

-- =====================================================================
-- 2) Envios de dependente: caminho driver_id direto (defensivo)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.notify_driver_dependent_shipment_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  drv uuid;
  v_trip_id uuid;
BEGIN
  v_trip_id := NEW.scheduled_trip_id;

  -- Resolve driver_id pela trip vinculada quando preenchida
  IF v_trip_id IS NOT NULL THEN
    SELECT st.driver_id INTO drv
    FROM public.scheduled_trips st
    WHERE st.id = v_trip_id;
  END IF;

  IF drv IS NULL THEN
    RETURN NEW;
  END IF;

  -- Só interessa quando a trip muda (insert ou update de scheduled_trip_id)
  IF NOT (
    TG_OP = 'INSERT'
    OR (TG_OP = 'UPDATE' AND OLD.scheduled_trip_id IS DISTINCT FROM NEW.scheduled_trip_id)
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NULL OR NEW.status NOT IN ('pending_review', 'confirmed') THEN
    RETURN NEW;
  END IF;

  BEGIN
    IF NOT public.should_notify_user(drv, 'shipments_deliveries') THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
    VALUES (
      drv,
      'Novo envio de dependente na sua viagem',
      'Um cliente solicitou um envio de dependente na sua rota. Veja em Solicitações pendentes.',
      'shipments_deliveries',
      'motorista',
      jsonb_build_object(
        'route', 'PendingRequests',
        'dependent_shipment_id', NEW.id,
        'fcm_collapse_key', 'dependent_shipment_request_' || NEW.id::text,
        'fcm_android_tag', 'dependent_shipment_request_' || NEW.id::text
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_driver_dependent_shipment_assigned] ignorado: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_driver_dependent_shipment_assigned() IS
  'Best-effort: notifica o motorista quando dependent_shipments é vinculado a uma scheduled_trip (INSERT ou UPDATE de scheduled_trip_id). Substitui o trigger anterior, agora com colapso por shipment_id pra evitar duplicação.';

-- Substitui o trigger anterior pelo trigger reforçado (mesmo nome lógico, função nova).
DROP TRIGGER IF EXISTS on_dependent_shipment_trip_notify_driver ON public.dependent_shipments;
CREATE TRIGGER on_dependent_shipment_trip_notify_driver
  AFTER INSERT OR UPDATE OF scheduled_trip_id, status ON public.dependent_shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_dependent_shipment_assigned();
