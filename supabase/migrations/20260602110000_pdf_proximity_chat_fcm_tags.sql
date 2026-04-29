-- =====================================================================
-- Alinhamento PDF: proximidade motorista (5 min / chegou), tag FCM no
-- "Motorista a caminho", títulos de chat por conversation_kind, ponto
-- final no título "viagem em andamento" (motorista), preferências para
-- novas categorias de proximidade, e notificações ao **cliente** de
-- encomenda quando o preparador inicia deslocamento / chega à coleta.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Colunas de idempotência (passageiro / dependente ainda não embarcados)
-- ---------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS driver_eta_5min_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS driver_arrived_pickup_notified_at timestamptz;

COMMENT ON COLUMN public.bookings.driver_eta_5min_notified_at IS
  'Preenchido pelo cron (notify-passenger-driver-proximity) após push "~5 min" para o ponto de embarque.';
COMMENT ON COLUMN public.bookings.driver_arrived_pickup_notified_at IS
  'Preenchido após push "Motorista chegou a você" (proximidade ao ponto de embarque).';

ALTER TABLE public.dependent_shipments
  ADD COLUMN IF NOT EXISTS driver_eta_5min_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS driver_arrived_pickup_notified_at timestamptz;

-- ---------------------------------------------------------------------
-- should_notify_user: mapear categorias de proximidade → travel_updates
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
      'booking',
      'driver_eta_5min', 'driver_arrived_pickup', 'trip_eta_live'
    ) THEN 'travel_updates'
    WHEN p_category IN ('shipments_deliveries', 'shipment', 'dependent_shipment', 'preparer_client_milestone') THEN 'shipments_deliveries'
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
-- Chat: título conforme conversation_kind
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
  v_title text;
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
    v_title := 'Nova mensagem da viagem';

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
    v_title := 'Takeme Suporte — Nova mensagem';

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
    v_title,
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

COMMENT ON FUNCTION public.notify_chat_message_received() IS
  'Push de chat: título "Nova mensagem da viagem" (driver_client) ou "Takeme Suporte — Nova mensagem" (support_backoffice).';

-- ---------------------------------------------------------------------
-- Motorista — título com ponto final (PDF)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_driver_trip_started()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.driver_journey_started_at IS NOT NULL OR NEW.driver_journey_started_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    IF NOT public.should_notify_user(NEW.driver_id, 'trip_started') THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
    VALUES (
      NEW.driver_id,
      'Sua viagem está em andamento.',
      format(
        'Viagem iniciada: %s → %s. Toque para abrir os detalhes.',
        left(coalesce(NEW.origin_address, 'origem'), 60),
        left(coalesce(NEW.destination_address, 'destino'), 60)
      ),
      'trip_started',
      'motorista',
      jsonb_build_object('route', 'ActiveTrip', 'params', jsonb_build_object('tripId', NEW.id))
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_driver_trip_started] ignorado: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- Passageiros: "Motorista a caminho" com tag FCM (atualizações de ETA
-- no mesmo slot Android quando o dispatch aplica fcm_android_tag)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_passengers_driver_journey_started()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dest_preview text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.driver_journey_started_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.driver_journey_started_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  dest_preview := left(coalesce(NEW.destination_address, 'destino'), 100);

  INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
  SELECT
    b.user_id,
    'Motorista a caminho',
    format('O motorista iniciou a viagem rumo a %s. Acompanhe no app.', dest_preview),
    'travel_updates',
    'cliente',
    jsonb_build_object(
      'route', 'DriverOnTheWay',
      'params', jsonb_build_object('tripId', NEW.id, 'bookingId', b.id),
      'fcm_android_tag', format('passenger_eta_%s', b.id),
      'fcm_collapse_key', format('passenger_eta_%s', b.id)
    )
  FROM public.bookings b
  WHERE b.scheduled_trip_id = NEW.id
    AND b.status IN ('paid', 'confirmed');

  INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
  SELECT
    ds.user_id,
    'Motorista a caminho',
    format('O motorista iniciou a viagem rumo a %s. Acompanhe no app.', dest_preview),
    'travel_updates',
    'cliente',
    jsonb_build_object(
      'route', 'DependentShipmentDetail',
      'params', jsonb_build_object('dependentShipmentId', ds.id),
      'fcm_android_tag', format('passenger_eta_ds_%s', ds.id),
      'fcm_collapse_key', format('passenger_eta_ds_%s', ds.id)
    )
  FROM public.dependent_shipments ds
  WHERE ds.scheduled_trip_id = NEW.id
    AND ds.status IN ('confirmed', 'in_progress');

  INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
  SELECT
    s.user_id,
    'Motorista a caminho',
    format('O motorista iniciou a viagem rumo a %s. Acompanhe no app.', dest_preview),
    'shipments_deliveries',
    'cliente',
    jsonb_build_object(
      'route', 'ShipmentDetail',
      'params', jsonb_build_object('shipmentId', s.id),
      'fcm_android_tag', format('passenger_eta_sh_%s', s.id),
      'fcm_collapse_key', format('passenger_eta_sh_%s', s.id)
    )
  FROM public.shipments s
  WHERE s.scheduled_trip_id = NEW.id
    AND s.status IN ('confirmed', 'in_progress');

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_passengers_driver_journey_started() IS
  'Motorista a caminho + data.fcm_android_tag para substituir a mesma notificação com updates de ETA (FCM v1 + Notifee).';

-- ---------------------------------------------------------------------
-- Cliente (encomenda): preparador a caminho / chegou — coleta
-- Substituição parcial de "5 min" até haver posição do preparador no
-- backend: disparamos na transição de fase do app do preparador.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_client_shipment_preparer_milestones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  v_user := NEW.user_id;
  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.preparer_pickup_started_at IS NOT NULL
     AND OLD.preparer_pickup_started_at IS DISTINCT FROM NEW.preparer_pickup_started_at
     AND OLD.preparer_pickup_started_at IS NULL THEN
    IF public.should_notify_user(v_user, 'preparer_client_milestone') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_user,
        'Preparador a caminho',
        'O preparador saiu em direção ao seu endereço. Você receberá um aviso quando estiver perto. Acompanhe no app.',
        'preparer_client_milestone',
        'cliente',
        jsonb_build_object(
          'route', 'ShipmentDetail',
          'params', jsonb_build_object('shipmentId', NEW.id)
        )
      );
    END IF;
  END IF;

  IF NEW.preparer_arrived_at_client_at IS NOT NULL
     AND OLD.preparer_arrived_at_client_at IS DISTINCT FROM NEW.preparer_arrived_at_client_at
     AND OLD.preparer_arrived_at_client_at IS NULL THEN
    IF public.should_notify_user(v_user, 'preparer_client_milestone') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_user,
        'O preparador chegou',
        'Informe o código de confirmação exibido no app para concluir a coleta.',
        'preparer_client_milestone',
        'cliente',
        jsonb_build_object(
          'route', 'ShipmentDetail',
          'params', jsonb_build_object('shipmentId', NEW.id)
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_client_shipment_preparer_milestones ON public.shipments;
CREATE TRIGGER trg_notify_client_shipment_preparer_milestones
  AFTER UPDATE OF preparer_pickup_started_at, preparer_arrived_at_client_at
  ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_shipment_preparer_milestones();

COMMENT ON FUNCTION public.notify_client_shipment_preparer_milestones() IS
  'Cliente (encomenda): avisos alinhados ao PDF quando o preparador inicia deslocamento e ao chegar para coleta (código).';
