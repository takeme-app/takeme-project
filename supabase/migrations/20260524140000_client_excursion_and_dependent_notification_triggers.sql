-- =====================================================================
-- Notificações do cliente (Fase 5): Excursão + Dependente.
--
-- Textos do spec (literal):
--
--   Excursão (public.excursion_requests):
--     - "Sua excursão está em andamento"                 (status -> in_progress)
--     - "Sua Excursão está em fase de check in de ida."  (check_in_ida_started_at
--                                                         NULL -> NOT NULL)
--     - "Sua Excursão está em fase de check in de volta."(check_in_volta_started_at
--                                                         NULL -> NOT NULL)
--     - "Sua excursão finalizou."                        (status -> completed)
--
--   Dependente - cadastro (public.dependents):
--     - "Dependente Cadastrado com Sucesso!"             (status -> validated)
--       Corpo: "Clique pra ver o cadastro do seu dependente."
--     - "Dependente não aprovado!"                       (status -> rejected)
--       Corpo: "Infelizmente seu dependente, não atende aos critérios da
--               takeme. Caso haja que houve um erro, por favor entre em
--               contato com o suporte Takeme."
--
--   Dependente - envio (public.dependent_shipments):
--     - "Seu dependente está chegando ao destino"        (confirmed -> in_progress)
--     - "Dependente Chegou ao Destino!"                  (in_progress -> delivered)
--       Corpo: "Aee Parabéns! Seu dependente chegou ao destino com sucesso."
--
-- Observações:
--   * O trigger genérico `notify_client_activity_status_changed` é
--     atualizado para suprimir as transições cobertas aqui (evita push
--     duplicado com o texto genérico "mudou de status").
--   * A trigger antiga `on_dependent_inserted_notify` (texto "Cadastro
--     enviado") é removida por estar fora do spec literal - o spec só
--     prevê eventos de aprovação/reprovação.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0) should_notify_user: reconhece as categorias `dependents` e
--    `excursions` (introduzidas desde a Fase 2) no grupo de preferência
--    `excursions_dependents`, para respeitar o opt-out do usuário.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.should_notify_user(
  p_user_id uuid,
  p_category text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pref_key text;
  disabled_all boolean;
  pref_enabled boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_category IN ('account_approved', 'account_rejected', 'account') THEN
    RETURN true;
  END IF;

  pref_key := CASE
    WHEN p_category IN (
      'travel_updates', 'trip_started', 'trip_completed', 'trip_closed',
      'trip_upcoming_1h', 'activity_status_changed', 'booking_cancelled_by_passenger',
      'booking'
    ) THEN 'travel_updates'
    WHEN p_category IN ('shipments_deliveries', 'shipment', 'dependent_shipment') THEN 'shipments_deliveries'
    WHEN p_category IN (
      'excursions_dependents', 'excursion', 'excursions',
      'dependent', 'dependents'
    ) THEN 'excursions_dependents'
    WHEN p_category IN ('payment_received') THEN 'payments_received'
    WHEN p_category IN ('payments_pending', 'payment') THEN 'payments_pending'
    WHEN p_category = 'payment_receipts' THEN 'payment_receipts'
    WHEN p_category = 'offers_promotions' THEN 'offers_promotions'
    WHEN p_category = 'app_updates' THEN 'app_updates'
    WHEN p_category = 'first_steps_hints' THEN 'first_steps_hints'
    ELSE NULL
  END;

  SELECT enabled INTO disabled_all
  FROM public.notification_preferences
  WHERE user_id = p_user_id AND key = 'disable_all';

  IF COALESCE(disabled_all, false) THEN
    RETURN false;
  END IF;

  IF pref_key IS NULL THEN
    RETURN true;
  END IF;

  SELECT enabled INTO pref_enabled
  FROM public.notification_preferences
  WHERE user_id = p_user_id AND key = pref_key;

  RETURN COALESCE(pref_enabled, true);
END;
$$;


-- ---------------------------------------------------------------------
-- 1) Fases da excursão para o cliente
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_client_excursion_phase_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_data jsonb;
BEGIN
  v_user := NEW.user_id;
  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;

  v_data := jsonb_build_object(
    'route', 'ExcursionDetail',
    'params', jsonb_build_object('excursionRequestId', NEW.id)
  );

  -- Check-in de ida iniciado.
  IF NEW.check_in_ida_started_at IS NOT NULL
     AND OLD.check_in_ida_started_at IS DISTINCT FROM NEW.check_in_ida_started_at
     AND OLD.check_in_ida_started_at IS NULL THEN
    IF public.should_notify_user(v_user, 'excursions') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_user,
        'Sua Excursão está em fase de check in de ida.',
        'Abra o app para conferir o embarque da sua excursão.',
        'excursions',
        'cliente',
        v_data
      );
    END IF;
  END IF;

  -- Check-in de volta iniciado.
  IF NEW.check_in_volta_started_at IS NOT NULL
     AND OLD.check_in_volta_started_at IS DISTINCT FROM NEW.check_in_volta_started_at
     AND OLD.check_in_volta_started_at IS NULL THEN
    IF public.should_notify_user(v_user, 'excursions') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_user,
        'Sua Excursão está em fase de check in de volta.',
        'Abra o app para conferir o embarque de volta da sua excursão.',
        'excursions',
        'cliente',
        v_data
      );
    END IF;
  END IF;

  -- Excursão em andamento.
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'in_progress' THEN
    IF public.should_notify_user(v_user, 'excursions') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_user,
        'Sua excursão está em andamento',
        'Acompanhe sua excursão em tempo real pelo app.',
        'excursions',
        'cliente',
        v_data
      );
    END IF;
  END IF;

  -- Excursão finalizada.
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
    IF public.should_notify_user(v_user, 'excursions') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_user,
        'Sua excursão finalizou.',
        'Esperamos que você tenha aproveitado! Toque para ver os detalhes.',
        'excursions',
        'cliente',
        v_data
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_client_excursion_phase_change ON public.excursion_requests;
CREATE TRIGGER trg_notify_client_excursion_phase_change
  AFTER UPDATE ON public.excursion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_excursion_phase_change();


-- ---------------------------------------------------------------------
-- 2) Dependente - cadastro (aprovação/reprovação pelo admin)
-- ---------------------------------------------------------------------

-- Remove o push de INSERT ("Cadastro enviado") que não consta no spec.
DROP TRIGGER IF EXISTS on_dependent_inserted_notify ON public.dependents;

-- Reescreve a função de validação para o texto literal do spec + rejected.
CREATE OR REPLACE FUNCTION public.notify_dependent_validated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data jsonb;
  v_reason text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_data := jsonb_build_object(
    'route', 'DependentDetail',
    'params', jsonb_build_object('dependentId', NEW.id)
  );

  -- Aprovação.
  IF NEW.status = 'validated' THEN
    IF public.should_notify_user(NEW.user_id, 'dependents') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        NEW.user_id,
        'Dependente Cadastrado com Sucesso!',
        'Clique pra ver o cadastro do seu dependente.',
        'dependents',
        'cliente',
        v_data
      );
    END IF;
    RETURN NEW;
  END IF;

  -- Reprovação.
  IF NEW.status = 'rejected' THEN
    IF public.should_notify_user(NEW.user_id, 'dependents') THEN
      v_reason := NULLIF(BTRIM(COALESCE(NEW.rejection_reason, '')), '');
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        NEW.user_id,
        'Dependente não aprovado!',
        CASE
          WHEN v_reason IS NULL THEN
            'Infelizmente seu dependente, não atende aos critérios da takeme. Caso haja que houve um erro, por favor entre em contato com o suporte Takeme.'
          ELSE
            'Infelizmente seu dependente, não atende aos critérios da takeme. Motivo: '
              || v_reason
              || ' Caso haja que houve um erro, por favor entre em contato com o suporte Takeme.'
        END,
        'dependents',
        'cliente',
        v_data
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------
-- 3) Dependente - envio (coleta -> em andamento -> entrega)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_client_dependent_shipment_phase_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_data jsonb;
BEGIN
  v_user := NEW.user_id;
  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;

  v_data := jsonb_build_object(
    'route', 'DependentShipmentDetail',
    'params', jsonb_build_object('dependentShipmentId', NEW.id)
  );

  -- Coleta concluida - dependente a caminho do destino.
  IF OLD.status = 'confirmed' AND NEW.status = 'in_progress' THEN
    IF public.should_notify_user(v_user, 'dependents') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_user,
        'Seu dependente está chegando ao destino',
        'Acompanhe o trajeto do seu dependente em tempo real pelo app.',
        'dependents',
        'cliente',
        v_data
      );
    END IF;
    RETURN NEW;
  END IF;

  -- Entrega confirmada - dependente chegou.
  IF OLD.status = 'in_progress' AND NEW.status = 'delivered' THEN
    IF public.should_notify_user(v_user, 'dependents') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_user,
        'Dependente Chegou ao Destino!',
        'Aee Parabéns! Seu dependente chegou ao destino com sucesso.',
        'dependents',
        'cliente',
        v_data
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_client_dependent_shipment_phase_change ON public.dependent_shipments;
CREATE TRIGGER trg_notify_client_dependent_shipment_phase_change
  AFTER UPDATE OF status ON public.dependent_shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_dependent_shipment_phase_change();


-- ---------------------------------------------------------------------
-- 4) Alinha o trigger genérico para suprimir transições cobertas acima
--    e seguir o texto literal do spec.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_client_activity_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_entity_label text;
  v_category text;
  v_route text;
  v_params jsonb;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'bookings' THEN
    v_user := NEW.user_id;
    v_entity_label := 'viagem';
    v_category := 'travel_updates';
    v_route := 'TripDetail';
    v_params := jsonb_build_object('bookingId', NEW.id);

    IF OLD.status = 'pending' AND NEW.status IN ('paid', 'confirmed') THEN
      RETURN NEW;
    END IF;
    IF OLD.status = 'paid' AND NEW.status = 'confirmed' THEN
      RETURN NEW;
    END IF;
    IF OLD.status = 'confirmed' AND NEW.status = 'paid' THEN
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'shipments' THEN
    v_user := NEW.user_id;
    v_entity_label := 'encomenda';
    v_category := 'shipments_deliveries';
    v_route := 'ShipmentDetail';
    v_params := jsonb_build_object('shipmentId', NEW.id);

    IF OLD.status = 'confirmed' AND NEW.status = 'in_progress' THEN
      RETURN NEW;
    END IF;
    IF OLD.status = 'in_progress' AND NEW.status = 'delivered' THEN
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'dependent_shipments' THEN
    v_user := NEW.user_id;
    v_entity_label := 'dependente';
    v_category := 'dependents';
    v_route := 'DependentShipmentDetail';
    v_params := jsonb_build_object('dependentShipmentId', NEW.id);

    -- Cobertas por notify_client_dependent_shipment_phase_change (Fase 5).
    IF OLD.status = 'confirmed' AND NEW.status = 'in_progress' THEN
      RETURN NEW;
    END IF;
    IF OLD.status = 'in_progress' AND NEW.status = 'delivered' THEN
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'excursion_requests' THEN
    v_user := NEW.user_id;
    v_entity_label := 'excursão';
    v_category := 'excursions';
    v_route := 'ExcursionDetail';
    v_params := jsonb_build_object('excursionRequestId', NEW.id);

    -- Cobertas por notify_client_excursion_phase_change (Fase 5).
    IF NEW.status = 'in_progress' THEN
      RETURN NEW;
    END IF;
    IF NEW.status = 'completed' THEN
      RETURN NEW;
    END IF;

  ELSE
    RETURN NEW;
  END IF;

  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.should_notify_user(v_user, v_category) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
  VALUES (
    v_user,
    format('Sua atividade de %s mudou de status', v_entity_label),
    format(
      'Sua %s tem uma nova atualização, clique e verifique.',
      v_entity_label
    ),
    v_category,
    'cliente',
    jsonb_build_object('route', v_route, 'params', v_params)
  );

  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------
-- 5) Comentários finais
-- ---------------------------------------------------------------------
COMMENT ON FUNCTION public.notify_client_excursion_phase_change() IS
  'Fase 5 - Dispara notificações literais do spec para a excursão do cliente (in_progress/completed + check-in de ida/volta).';
COMMENT ON FUNCTION public.notify_client_dependent_shipment_phase_change() IS
  'Fase 5 - Dispara notificações literais do spec para o envio do dependente (confirmed->in_progress e in_progress->delivered).';
COMMENT ON FUNCTION public.notify_dependent_validated() IS
  'Fase 5 - Texto literal do spec para aprovação (validated) e reprovação (rejected) do dependente.';
