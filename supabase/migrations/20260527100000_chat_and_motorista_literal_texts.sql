-- =====================================================================
-- Fase 8 - Chat + textos literais remanescentes (motorista).
--
-- 1) Push para QUALQUER mensagem de chat, nos dois lados (cliente/motorista).
--    Também cobre a fila de suporte (admin -> support_requester_id).
--    Textos do spec:
--        Título : "Takeme Suporte Nova mensagem"
--        Corpo  : conteúdo da mensagem (truncado).
--
-- 2) Motorista - alinhamento de texto ao spec (literal):
--    - "Você recebeu uma nova Solicitação de Viagem!" /
--      "Clique para visualizar a solicitação."                (nova reserva)
--    - "Um passageiro cancelou a Viagem!" /
--      "Clique para visualizar os detalhes da viagem em
--      questão."                                              (cancelamento)
--    - "Sua atividade de {viagem/encomenda/dependente} mudou de status" /
--      "Sua {entity} tem uma nova atualização, clique e verifique."
--                                                             (genérico)
--    - "Sua viagem está fechada, confira quem vai com você!" /
--      "{N} Encomendas, {M} Passageiros. Clique para ver os
--      detalhes.."                                            (trip_closed)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Trigger de notificação de mensagens de chat.
--
-- Regras:
--   conversation_kind = 'driver_client'
--     sender = client_id  -> destino driver_id  (app 'motorista')
--     sender = driver_id  -> destino client_id  (app 'cliente')
--   conversation_kind = 'support_backoffice'
--     sender = admin_id   -> destino support_requester_id
--         (app detectado via worker_profiles: existe -> 'motorista',
--          ausente -> 'cliente')
--     outros senders      -> ignorado (admin não recebe push no app).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_chat_message_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv RECORD;
  v_recipient uuid;
  v_app_slug text;
  v_preview text;
  v_has_worker boolean;
BEGIN
  SELECT
    id,
    driver_id,
    client_id,
    admin_id,
    support_requester_id,
    conversation_kind
  INTO v_conv
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_conv.conversation_kind = 'driver_client' THEN
    IF NEW.sender_id = v_conv.client_id THEN
      v_recipient := v_conv.driver_id;
      v_app_slug := 'motorista';
    ELSIF NEW.sender_id = v_conv.driver_id THEN
      v_recipient := v_conv.client_id;
      v_app_slug := 'cliente';
    ELSE
      RETURN NEW;
    END IF;

  ELSIF v_conv.conversation_kind = 'support_backoffice' THEN
    IF NEW.sender_id = v_conv.admin_id AND v_conv.support_requester_id IS NOT NULL THEN
      v_recipient := v_conv.support_requester_id;
      SELECT EXISTS (
        SELECT 1 FROM public.worker_profiles wp
        WHERE wp.id = v_recipient
      ) INTO v_has_worker;
      v_app_slug := CASE WHEN v_has_worker THEN 'motorista' ELSE 'cliente' END;
    ELSE
      RETURN NEW;
    END IF;

  ELSE
    RETURN NEW;
  END IF;

  IF v_recipient IS NULL OR v_recipient = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  v_preview := LEFT(COALESCE(NEW.content, ''), 150);
  IF v_preview = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
  VALUES (
    v_recipient,
    'Takeme Suporte Nova mensagem',
    v_preview,
    'chat_message',
    v_app_slug,
    jsonb_build_object(
      'route', 'Chat',
      'params', jsonb_build_object('conversationId', NEW.conversation_id)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_chat_message_received ON public.messages;
CREATE TRIGGER trg_notify_chat_message_received
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_message_received();

COMMENT ON FUNCTION public.notify_chat_message_received() IS
  'Fase 8 - Dispara push "Takeme Suporte Nova mensagem" para o destinatário de cada INSERT em public.messages (driver_client e support_backoffice).';


-- ---------------------------------------------------------------------
-- 2.1) Motorista - "nova solicitação de viagem" (texto literal do spec).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_driver_new_booking_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  drv uuid;
BEGIN
  IF NEW.status IS NULL OR NEW.status NOT IN ('pending', 'paid') THEN
    RETURN NEW;
  END IF;

  SELECT st.driver_id
  INTO drv
  FROM public.scheduled_trips st
  WHERE st.id = NEW.scheduled_trip_id;

  IF drv IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.should_notify_user(drv, 'travel_updates') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
  VALUES (
    drv,
    'Você recebeu uma nova Solicitação de Viagem!',
    'Clique para visualizar a solicitação.',
    'travel_updates',
    'motorista',
    jsonb_build_object('route', 'PendingRequests')
  );

  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------
-- 2.2) Motorista - "passageiro cancelou" + "atividade mudou de status"
--      (textos literais do spec). Mantém a assinatura existente do
--      trigger notify_driver_activity_status_changed (acionado para
--      bookings/shipments/dependent_shipments).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_driver_activity_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver uuid;
  v_trip_id uuid;
  v_entity_label text;
  v_title text;
  v_message text;
  v_category text;
  v_data jsonb;
BEGIN
  IF TG_TABLE_NAME = 'shipments' THEN
    v_entity_label := 'encomenda';
    v_trip_id := NEW.scheduled_trip_id;
    IF NEW.driver_id IS NOT NULL THEN
      v_driver := NEW.driver_id;
    ELSIF v_trip_id IS NOT NULL THEN
      SELECT st.driver_id INTO v_driver FROM public.scheduled_trips st WHERE st.id = v_trip_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'bookings' THEN
    v_entity_label := 'viagem';
    v_trip_id := NEW.scheduled_trip_id;
    IF v_trip_id IS NOT NULL THEN
      SELECT st.driver_id INTO v_driver FROM public.scheduled_trips st WHERE st.id = v_trip_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'dependent_shipments' THEN
    v_entity_label := 'dependente';
    v_trip_id := NEW.scheduled_trip_id;
    IF v_trip_id IS NOT NULL THEN
      SELECT st.driver_id INTO v_driver FROM public.scheduled_trips st WHERE st.id = v_trip_id;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF v_driver IS NULL THEN
    RETURN NEW;
  END IF;

  -- Caso 1: "Um passageiro cancelou a Viagem!" (bookings paid/confirmed -> cancelled,
  -- exceto cancelamentos automáticos driver_/system_/admin_).
  IF TG_TABLE_NAME = 'bookings'
     AND OLD.status IN ('paid', 'confirmed')
     AND NEW.status = 'cancelled'
     AND (
       NEW.cancellation_reason IS NULL
       OR (
         NEW.cancellation_reason NOT LIKE 'driver\_%' ESCAPE '\'
         AND NEW.cancellation_reason NOT LIKE 'system\_%' ESCAPE '\'
         AND NEW.cancellation_reason NOT LIKE 'admin\_%' ESCAPE '\'
       )
     ) THEN
    v_title := 'Um passageiro cancelou a Viagem!';
    v_message := 'Clique para visualizar os detalhes da viagem em questão.';
    v_category := 'booking_cancelled_by_passenger';
    v_data := jsonb_build_object(
      'route', 'TripDetail',
      'params', jsonb_build_object('tripId', v_trip_id)
    );

    IF public.should_notify_user(v_driver, v_category) THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (v_driver, v_title, v_message, v_category, 'motorista', v_data);
    END IF;

    RETURN NEW;
  END IF;

  -- Caso 2: Genérico - "Sua atividade de XXX mudou de status".
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Evita ruído duplicado com o trigger de "nova solicitação".
    IF TG_TABLE_NAME = 'bookings'
       AND OLD.status = 'pending'
       AND NEW.status IN ('paid', 'confirmed') THEN
      RETURN NEW;
    END IF;

    v_title := format('Sua atividade de %s mudou de status', v_entity_label);
    v_message := format(
      'Sua %s tem uma nova atualização, clique e verifique.',
      v_entity_label
    );
    v_category := 'activity_status_changed';
    v_data := CASE
      WHEN v_trip_id IS NOT NULL THEN jsonb_build_object(
        'route', 'TripDetail',
        'params', jsonb_build_object('tripId', v_trip_id)
      )
      ELSE NULL
    END;

    IF public.should_notify_user(v_driver, v_category) THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (v_driver, v_title, v_message, v_category, 'motorista', v_data);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------
-- 2.3) Motorista - "trip_closed" com contagem dinâmica de encomendas
--      e passageiros (texto literal do spec).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_driver_trip_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_message text;
  v_category text;
  v_route text;
  v_packages integer;
  v_passengers integer;
BEGIN
  IF NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Viagem finalizada.
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
    v_title := 'Viagem finalizada. Parabéns!';
    v_message := format(
      'Você concluiu a viagem %s → %s. Confira o histórico para detalhes.',
      LEFT(COALESCE(NEW.origin_address, 'origem'), 60),
      LEFT(COALESCE(NEW.destination_address, 'destino'), 60)
    );
    v_category := 'trip_completed';
    v_route := 'TripHistory';

    IF public.should_notify_user(NEW.driver_id, v_category) THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        NEW.driver_id,
        v_title,
        v_message,
        v_category,
        'motorista',
        jsonb_build_object('route', v_route, 'params', jsonb_build_object('tripId', NEW.id))
      );
    END IF;
  END IF;

  -- Viagem fechada (lotou): seats_available passou de >0 para 0 e trip ativa.
  IF NEW.status = 'active'
     AND OLD.seats_available IS DISTINCT FROM NEW.seats_available
     AND NEW.seats_available = 0
     AND COALESCE(OLD.seats_available, 0) > 0 THEN

    SELECT COUNT(*)::int INTO v_packages
    FROM public.shipments s
    WHERE s.scheduled_trip_id = NEW.id
      AND s.status IN ('confirmed', 'in_progress', 'delivered');

    SELECT COUNT(*)::int INTO v_passengers
    FROM public.bookings b
    WHERE b.scheduled_trip_id = NEW.id
      AND b.status IN ('paid', 'confirmed');

    v_title := 'Sua viagem está fechada, confira quem vai com você!';
    v_message := format(
      '%s Encomendas, %s Passageiros. Clique para ver os detalhes..',
      COALESCE(v_packages, 0),
      COALESCE(v_passengers, 0)
    );
    v_category := 'trip_closed';
    v_route := 'TripDetail';

    IF public.should_notify_user(NEW.driver_id, v_category) THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        NEW.driver_id,
        v_title,
        v_message,
        v_category,
        'motorista',
        jsonb_build_object('route', v_route, 'params', jsonb_build_object('tripId', NEW.id))
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------
-- 3) Comentários finais
-- ---------------------------------------------------------------------
COMMENT ON FUNCTION public.notify_driver_new_booking_request() IS
  'Fase 8 - Texto literal do spec: "Você recebeu uma nova Solicitação de Viagem!".';
COMMENT ON FUNCTION public.notify_driver_activity_status_changed() IS
  'Fase 8 - Textos literais do spec para cancelamento por passageiro e "atividade mudou de status".';
COMMENT ON FUNCTION public.notify_driver_trip_lifecycle() IS
  'Fase 8 - Texto literal do spec para trip_closed com contagem de encomendas/passageiros.';
