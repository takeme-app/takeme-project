-- =====================================================================
-- Notificações do Preparador de Excursão (Fase 6).
--
-- Textos do spec (literal):
--
--   Eventos operacionais (excursão):
--     - "Sua viagem inciará em 40 minutos"    (edge function cron — usa
--                                              upcoming_40min_notified_at)
--     - "Sua Excursão está em andamento."     (status -> in_progress)
--     - "Sua Excursão Finalizou."             (status -> completed)
--
--   Notificações de Status / Cadastro / Pagamento:
--     - "Sua atividade de XXX mudou de status" /
--       "Sua (viagem, encomenda, excursão, dependente) tem uma nova
--       atualização, clique e verifique."
--     - "Você recebeu um pagamento!" /
--       "Aee Parabéns! Confira seu Pagamento!"
--     - "Cadastro de Preparador Excursão Aprovado! Takeme" /
--       "Aee Parabéns! Cadastro Aprovado, aguarde as excursões e comece a
--       viajar!"
--     - "Cadastro de Preparador Excursão Reprovado! Takeme" /
--       "Agradeçemos seu interesse, mas não podemos seguir com o seu
--       cadastro no momento!"
--
-- Convenções:
--   * O preparer de excursão usa o app_slug 'motorista' (mesmo app).
--   * Categorias novas: excursion_started, excursion_completed,
--     excursion_upcoming_40min -> grupo de preferência excursions_dependents.
--   * Escopo desta fase: motoristas (takeme/partner) e preparer excursão
--     (subtype='excursions'). Preparer de encomendas (subtype='shipments')
--     NÃO é tocado aqui (regra do repositório). Textos literais do spec do
--     motorista também são atualizados para aderência 100%.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0) should_notify_user: adiciona categorias novas ao grupo de preferência
--    `excursions_dependents` (para respeitar opt-out do preparador).
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
      'excursion_started', 'excursion_completed', 'excursion_upcoming_40min',
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
-- 1) Fases da excursão para o preparador (in_progress / completed)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_preparer_excursion_phase_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preparer uuid;
  v_data jsonb;
BEGIN
  v_preparer := NEW.preparer_id;
  IF v_preparer IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_data := jsonb_build_object(
    'route', 'DetalhesExcursao',
    'params', jsonb_build_object('excursionId', NEW.id)
  );

  IF NEW.status = 'in_progress' THEN
    IF public.should_notify_user(v_preparer, 'excursion_started') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_preparer,
        'Sua Excursão está em andamento.',
        'Acompanhe o andamento da excursão pelo app.',
        'excursion_started',
        'motorista',
        v_data
      );
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'completed' THEN
    IF public.should_notify_user(v_preparer, 'excursion_completed') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_preparer,
        'Sua Excursão Finalizou.',
        'Obrigado pela operação! Toque para conferir o fechamento.',
        'excursion_completed',
        'motorista',
        v_data
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_preparer_excursion_phase_change ON public.excursion_requests;
CREATE TRIGGER trg_notify_preparer_excursion_phase_change
  AFTER UPDATE OF status ON public.excursion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_preparer_excursion_phase_change();


-- ---------------------------------------------------------------------
-- 2) "Sua atividade de excursão mudou de status" para o preparador
--    (qualquer transição diferente das cobertas em 1).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_preparer_excursion_activity_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preparer uuid;
  v_data jsonb;
BEGIN
  v_preparer := NEW.preparer_id;
  IF v_preparer IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Cobertas por notify_preparer_excursion_phase_change.
  IF NEW.status IN ('in_progress', 'completed') THEN
    RETURN NEW;
  END IF;

  IF NOT public.should_notify_user(v_preparer, 'activity_status_changed') THEN
    RETURN NEW;
  END IF;

  v_data := jsonb_build_object(
    'route', 'DetalhesExcursao',
    'params', jsonb_build_object('excursionId', NEW.id)
  );

  INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
  VALUES (
    v_preparer,
    'Sua atividade de excursão mudou de status',
    'Sua excursão tem uma nova atualização, clique e verifique.',
    'activity_status_changed',
    'motorista',
    v_data
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_preparer_excursion_activity_status_changed ON public.excursion_requests;
CREATE TRIGGER trg_notify_preparer_excursion_activity_status_changed
  AFTER UPDATE OF status ON public.excursion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_preparer_excursion_activity_status_changed();


-- ---------------------------------------------------------------------
-- 3) Cadastro aprovado/reprovado — agora cobre motorista + preparer excursão
--    com textos literais do spec. Preparer de encomendas NÃO é tocado aqui.
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
  v_title text;
  v_message text;
  v_route text;
BEGIN
  v_is_driver := NEW.subtype IS NOT NULL AND NEW.subtype IN ('takeme', 'partner');
  v_is_preparer_excursion :=
    NEW.role = 'preparer' AND NEW.subtype = 'excursions';

  IF NOT (v_is_driver OR v_is_preparer_excursion) THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    IF v_is_driver THEN
      v_title := 'Cadastro Aprovado! Takeme';
      v_message := 'Aee Parabéns! Cadastro Aprovado,cadastre suas rotas e comece a viajar!';
      v_route := 'Main';
    ELSE
      v_title := 'Cadastro de Preparador Excursão Aprovado! Takeme';
      v_message := 'Aee Parabéns! Cadastro Aprovado, aguarde as excursões e comece a viajar!';
      v_route := 'Main';
    END IF;

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
    ELSE
      v_title := 'Cadastro de Preparador Excursão Reprovado! Takeme';
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

-- Trigger já existe do driver_notification_triggers; apenas garante estado.
DROP TRIGGER IF EXISTS trg_notify_driver_account_status_change ON public.worker_profiles;
CREATE TRIGGER trg_notify_driver_account_status_change
  AFTER UPDATE OF status ON public.worker_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_account_status_change();


-- ---------------------------------------------------------------------
-- 4) Pagamento recebido — texto literal do spec (aplicável a motoristas e
--    preparers; o worker_id em payouts já é o destinatário correto).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_driver_payment_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.worker_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status OR NEW.status <> 'paid' THEN
    RETURN NEW;
  END IF;

  IF NOT public.should_notify_user(NEW.worker_id, 'payment_received') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
  VALUES (
    NEW.worker_id,
    'Você recebeu um pagamento!',
    'Aee Parabéns! Confira seu Pagamento!',
    'payment_received',
    'motorista',
    jsonb_build_object('route', 'PaymentHistory')
  );

  RETURN NEW;
END;
$$;

-- Garante trigger (já criado pelo 20260520190000_*).
DROP TRIGGER IF EXISTS trg_notify_driver_payment_received ON public.payouts;
CREATE TRIGGER trg_notify_driver_payment_received
  AFTER UPDATE OF status ON public.payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_payment_received();


-- ---------------------------------------------------------------------
-- 5) Comentários finais
-- ---------------------------------------------------------------------
COMMENT ON FUNCTION public.notify_preparer_excursion_phase_change() IS
  'Fase 6 - Notificações do preparador de excursão para status -> in_progress / completed (textos literais do spec).';
COMMENT ON FUNCTION public.notify_preparer_excursion_activity_status_changed() IS
  'Fase 6 - "Sua atividade de excursão mudou de status" para o preparador (outras transições).';
COMMENT ON FUNCTION public.notify_driver_account_status_change() IS
  'Fase 6 - Cadastro aprovado/reprovado para motorista e preparer excursão (textos literais do spec).';
COMMENT ON FUNCTION public.notify_driver_payment_received() IS
  'Fase 6 - Texto literal do spec para pagamento recebido.';
