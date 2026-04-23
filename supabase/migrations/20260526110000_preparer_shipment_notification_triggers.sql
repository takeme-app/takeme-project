-- =====================================================================
-- Notificações do Preparador de Encomendas (Fase 7).
--
-- Textos do spec (literal):
--
--   Eventos operacionais (shipments.preparer_id):
--     - "Você está indo coletar o pacote XXXXX" (preparer_pickup_started_at
--                                                 NULL -> NOT NULL)
--     - "Você chegou ao cliente!"              (preparer_arrived_at_client_at
--                                                 NULL -> NOT NULL)
--     - "Indo para a base"                     (preparer_to_base_started_at
--                                                 NULL -> NOT NULL)
--     - "Você chegou a base, entregue o pacote." (preparer_arrived_at_base_at
--                                                 NULL -> NOT NULL)
--
--   Atividade / cadastro:
--     - "Sua atividade de encomenda mudou de status" /
--       "Sua encomenda tem uma nova atualização, clique e verifique."
--     - "Cadastro de Preparador de Encomendas Aprovado! Takeme" /
--       "Aee Parabéns! Cadastro Aprovado, veja os pacotes e comece a viajar!"
--     - "Cadastro de Preparador de Encomendas Reprovado! Takeme" /
--       "Agradeçemos seu interesse, mas não podemos seguir com o seu
--       cadastro no momento!"
--
--   Pagamento recebido:
--     Já coberto pelo trigger consolidado notify_driver_payment_received
--     (texto literal do spec atualizado na Fase 6).
--
-- Convenções:
--   * Preparer de encomendas usa app_slug 'motorista' (mesmo app).
--   * Categorias:
--       shipments_deliveries       -> operacional + cadastro preparer shipments
--       activity_status_changed    -> atividade mudou de status
--   * Respeita a regra "não alterar ambiente do preparador de encomendas"
--     no nível de UI/Edge/RPC: esta fase toca apenas TRIGGERS e colunas
--     novas em `shipments` (retrocompatíveis). A UI do preparador será
--     evoluída em PR futuro para preencher as colunas de tracking.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Fases operacionais do preparador de encomendas
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_preparer_shipment_phase_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preparer uuid;
  v_data jsonb;
  v_short_id text;
BEGIN
  v_preparer := NEW.preparer_id;
  IF v_preparer IS NULL THEN
    RETURN NEW;
  END IF;

  v_data := jsonb_build_object(
    'route', 'ActiveShipment',
    'params', jsonb_build_object('shipmentId', NEW.id)
  );
  v_short_id := UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 5));

  -- "Você está indo coletar o pacote XXXXX"
  IF NEW.preparer_pickup_started_at IS NOT NULL
     AND OLD.preparer_pickup_started_at IS DISTINCT FROM NEW.preparer_pickup_started_at
     AND OLD.preparer_pickup_started_at IS NULL THEN
    IF public.should_notify_user(v_preparer, 'shipments_deliveries') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_preparer,
        format('Você está indo coletar o pacote %s', v_short_id),
        'Abra o app para navegar até o ponto de coleta.',
        'shipments_deliveries',
        'motorista',
        v_data
      );
    END IF;
  END IF;

  -- "Você chegou ao cliente!"
  IF NEW.preparer_arrived_at_client_at IS NOT NULL
     AND OLD.preparer_arrived_at_client_at IS DISTINCT FROM NEW.preparer_arrived_at_client_at
     AND OLD.preparer_arrived_at_client_at IS NULL THEN
    IF public.should_notify_user(v_preparer, 'shipments_deliveries') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_preparer,
        'Você chegou ao cliente!',
        'Confirme o recebimento do pacote e siga o próximo passo no app.',
        'shipments_deliveries',
        'motorista',
        v_data
      );
    END IF;
  END IF;

  -- "Indo para a base"
  IF NEW.preparer_to_base_started_at IS NOT NULL
     AND OLD.preparer_to_base_started_at IS DISTINCT FROM NEW.preparer_to_base_started_at
     AND OLD.preparer_to_base_started_at IS NULL THEN
    IF public.should_notify_user(v_preparer, 'shipments_deliveries') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_preparer,
        'Indo para a base',
        'Boa viagem! Abra o app para navegar até a base.',
        'shipments_deliveries',
        'motorista',
        v_data
      );
    END IF;
  END IF;

  -- "Você chegou a base, entregue o pacote."
  IF NEW.preparer_arrived_at_base_at IS NOT NULL
     AND OLD.preparer_arrived_at_base_at IS DISTINCT FROM NEW.preparer_arrived_at_base_at
     AND OLD.preparer_arrived_at_base_at IS NULL THEN
    IF public.should_notify_user(v_preparer, 'shipments_deliveries') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_preparer,
        'Você chegou a base, entregue o pacote.',
        'Finalize o procedimento de entrega diretamente no app.',
        'shipments_deliveries',
        'motorista',
        v_data
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_preparer_shipment_phase_change ON public.shipments;
CREATE TRIGGER trg_notify_preparer_shipment_phase_change
  AFTER UPDATE OF
    preparer_pickup_started_at,
    preparer_arrived_at_client_at,
    preparer_to_base_started_at,
    preparer_arrived_at_base_at
  ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_preparer_shipment_phase_change();


-- ---------------------------------------------------------------------
-- 2) "Sua atividade de encomenda mudou de status" para o preparador
--    (quando shipments.status muda e preparer_id está preenchido).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_preparer_shipment_activity_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preparer uuid;
BEGIN
  v_preparer := NEW.preparer_id;
  IF v_preparer IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT public.should_notify_user(v_preparer, 'activity_status_changed') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
  VALUES (
    v_preparer,
    'Sua atividade de encomenda mudou de status',
    'Sua encomenda tem uma nova atualização, clique e verifique.',
    'activity_status_changed',
    'motorista',
    jsonb_build_object(
      'route', 'ActiveShipment',
      'params', jsonb_build_object('shipmentId', NEW.id)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_preparer_shipment_activity_status_changed ON public.shipments;
CREATE TRIGGER trg_notify_preparer_shipment_activity_status_changed
  AFTER UPDATE OF status ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_preparer_shipment_activity_status_changed();


-- ---------------------------------------------------------------------
-- 3) Cadastro aprovado/reprovado — passa a cobrir também
--    subtype='shipments' (preparador de encomendas).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_driver_account_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_driver boolean;
  v_is_preparer_excursion boolean;
  v_is_preparer_shipment boolean;
  v_title text;
  v_message text;
  v_route text;
BEGIN
  v_is_driver := NEW.subtype IS NOT NULL AND NEW.subtype IN ('takeme', 'partner');
  v_is_preparer_excursion :=
    NEW.role = 'preparer' AND NEW.subtype = 'excursions';
  v_is_preparer_shipment :=
    NEW.role = 'preparer' AND NEW.subtype = 'shipments';

  IF NOT (v_is_driver OR v_is_preparer_excursion OR v_is_preparer_shipment) THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    IF v_is_driver THEN
      v_title := 'Cadastro Aprovado! Takeme';
      v_message := 'Aee Parabéns! Cadastro Aprovado,cadastre suas rotas e comece a viajar!';
    ELSIF v_is_preparer_excursion THEN
      v_title := 'Cadastro de Preparador Excursão Aprovado! Takeme';
      v_message := 'Aee Parabéns! Cadastro Aprovado, aguarde as excursões e comece a viajar!';
    ELSE
      v_title := 'Cadastro de Preparador de Encomendas Aprovado! Takeme';
      v_message := 'Aee Parabéns! Cadastro Aprovado, veja os pacotes e comece a viajar!';
    END IF;
    v_route := 'Main';

    INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
    VALUES (
      NEW.id,
      v_title,
      v_message,
      'account_approved',
      'motorista',
      jsonb_build_object('route', v_route)
    );

    RETURN NEW;
  END IF;

  IF NEW.status = 'rejected' THEN
    IF v_is_driver THEN
      v_title := 'Cadastro de Motorista Reprovado! Takeme';
    ELSIF v_is_preparer_excursion THEN
      v_title := 'Cadastro de Preparador Excursão Reprovado! Takeme';
    ELSE
      v_title := 'Cadastro de Preparador de Encomendas Reprovado! Takeme';
    END IF;
    v_message := 'Agradeçemos seu interesse, mas não podemos seguir com o seu cadastro no momento!';

    INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
    VALUES (
      NEW.id,
      v_title,
      v_message,
      'account_rejected',
      'motorista',
      jsonb_build_object('route', 'MotoristaPendingApproval')
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Garante trigger em worker_profiles.
DROP TRIGGER IF EXISTS trg_notify_driver_account_status_change ON public.worker_profiles;
CREATE TRIGGER trg_notify_driver_account_status_change
  AFTER UPDATE OF status ON public.worker_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_account_status_change();


-- ---------------------------------------------------------------------
-- 4) Comentários finais
-- ---------------------------------------------------------------------
COMMENT ON FUNCTION public.notify_preparer_shipment_phase_change() IS
  'Fase 7 - Notificações operacionais do preparador de encomendas (coleta/cliente/base) com texto literal do spec.';
COMMENT ON FUNCTION public.notify_preparer_shipment_activity_status_changed() IS
  'Fase 7 - "Sua atividade de encomenda mudou de status" direcionada ao shipments.preparer_id.';
COMMENT ON FUNCTION public.notify_driver_account_status_change() IS
  'Fase 7 - Cadastro aprovado/reprovado para motorista, preparer excursão e preparer encomendas (textos literais do spec).';
