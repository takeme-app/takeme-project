-- Novos eventos de notificação para o motorista (takeme/partner).
-- Todos inserem em public.notifications com target_app_slug = 'motorista' e,
-- quando aplicável, preenchem `data` para o deeplink. O filtro de preferências
-- é aplicado via public.should_notify_user(user_id, category); se retornar FALSE
-- a inserção é pulada (preferência "fcm_and_inbox": não cria linha no inbox nem
-- envia push).
--
-- Eventos cobertos neste arquivo:
--   1) Viagem em andamento              -> category = trip_started
--   2) Viagem finalizada                -> category = trip_completed
--   3) Viagem fechada (lotou)           -> category = trip_closed
--   4) Status de atividade mudou        -> category = activity_status_changed
--   5) Passageiro cancelou              -> category = booking_cancelled_by_passenger
--   6) Cadastro aprovado/reprovado      -> category = account_approved / account_rejected
--   7) Pagamento recebido               -> category = payment_received
--
-- A notificação "1h antes" é emitida por Edge Function (notify-driver-upcoming-trips).

-- =====================================================================
-- 1) Viagem em andamento (driver_journey_started_at passa a ser preenchido)
-- =====================================================================
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

  IF NOT public.should_notify_user(NEW.driver_id, 'trip_started') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
  VALUES (
    NEW.driver_id,
    'Sua viagem está em andamento',
    format(
      'Viagem iniciada: %s → %s. Toque para abrir os detalhes.',
      left(coalesce(NEW.origin_address, 'origem'), 60),
      left(coalesce(NEW.destination_address, 'destino'), 60)
    ),
    'trip_started',
    'motorista',
    jsonb_build_object('route', 'ActiveTrip', 'params', jsonb_build_object('tripId', NEW.id))
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_driver_trip_started ON public.scheduled_trips;
CREATE TRIGGER trg_notify_driver_trip_started
  AFTER UPDATE OF driver_journey_started_at ON public.scheduled_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_trip_started();

-- =====================================================================
-- 2) Viagem finalizada (scheduled_trips.status -> completed)
-- 3) Viagem fechada (seats_available passa a 0 com trip ainda active)
-- Ambos compartilham a mesma função para economizar disparos.
-- =====================================================================
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
BEGIN
  IF NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Viagem finalizada
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
    v_title := 'Viagem finalizada. Parabéns!';
    v_message := format(
      'Você concluiu a viagem %s → %s. Confira o histórico para detalhes.',
      left(coalesce(NEW.origin_address, 'origem'), 60),
      left(coalesce(NEW.destination_address, 'destino'), 60)
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

  -- Viagem fechada (lotou) — seats_available passou de >0 para 0 e trip ainda ativa.
  IF NEW.status = 'active'
     AND OLD.seats_available IS DISTINCT FROM NEW.seats_available
     AND NEW.seats_available = 0
     AND COALESCE(OLD.seats_available, 0) > 0 THEN
    v_title := 'Sua viagem está fechada!';
    v_message := format(
      'Confira quem vai com você em %s → %s.',
      left(coalesce(NEW.origin_address, 'origem'), 60),
      left(coalesce(NEW.destination_address, 'destino'), 60)
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

DROP TRIGGER IF EXISTS trg_notify_driver_trip_lifecycle ON public.scheduled_trips;
CREATE TRIGGER trg_notify_driver_trip_lifecycle
  AFTER UPDATE OF status, seats_available ON public.scheduled_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_trip_lifecycle();

-- =====================================================================
-- 4) Status de atividade mudou (bookings / shipments / dependent_shipments)
--    + "Passageiro cancelou" como variação em bookings.
-- =====================================================================
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
  -- Descobre o driver_id via scheduled_trip (bookings e dependent_shipments)
  -- ou via coluna driver_id direta (shipments).
  IF TG_TABLE_NAME = 'shipments' THEN
    v_entity_label := 'encomenda';
    v_trip_id := NEW.scheduled_trip_id;
    IF NEW.driver_id IS NOT NULL THEN
      v_driver := NEW.driver_id;
    ELSIF v_trip_id IS NOT NULL THEN
      SELECT st.driver_id INTO v_driver FROM public.scheduled_trips st WHERE st.id = v_trip_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'bookings' THEN
    v_entity_label := 'reserva';
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

  -- Caso 1: "Passageiro cancelou a viagem" — bookings paid/confirmed -> cancelled,
  -- e o motivo NÃO é de cancelamento automático (driver_/system_/admin_).
  IF TG_TABLE_NAME = 'bookings'
     AND OLD.status IN ('paid', 'confirmed')
     AND NEW.status = 'cancelled'
     AND (
       NEW.cancellation_reason IS NULL
       OR NEW.cancellation_reason NOT LIKE 'driver\_%' ESCAPE '\'
       AND NEW.cancellation_reason NOT LIKE 'system\_%' ESCAPE '\'
       AND NEW.cancellation_reason NOT LIKE 'admin\_%' ESCAPE '\'
     ) THEN
    v_title := 'Um passageiro cancelou a viagem';
    v_message := 'Uma reserva confirmada da sua viagem foi cancelada pelo passageiro. Os próximos passos (estorno/reenvio) seguem automáticos.';
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

  -- Caso 2: Qualquer outra mudança de status vira "atividade mudou de status"
  -- (exceto o caminho pending -> paid/confirmed de bookings, que já é coberto
  -- pelo trigger de "nova solicitação" — evita ruído dobrado).
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF TG_TABLE_NAME = 'bookings'
       AND OLD.status = 'pending'
       AND NEW.status IN ('paid', 'confirmed') THEN
      RETURN NEW;
    END IF;

    v_title := format('Sua atividade (%s) mudou de status', v_entity_label);
    v_message := format(
      'Novo status: %s. Toque para ver detalhes.',
      coalesce(NEW.status, 'desconhecido')
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

DROP TRIGGER IF EXISTS trg_notify_driver_activity_bookings ON public.bookings;
CREATE TRIGGER trg_notify_driver_activity_bookings
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_activity_status_changed();

DROP TRIGGER IF EXISTS trg_notify_driver_activity_shipments ON public.shipments;
CREATE TRIGGER trg_notify_driver_activity_shipments
  AFTER UPDATE OF status ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_activity_status_changed();

DROP TRIGGER IF EXISTS trg_notify_driver_activity_dependent_shipments ON public.dependent_shipments;
CREATE TRIGGER trg_notify_driver_activity_dependent_shipments
  AFTER UPDATE OF status ON public.dependent_shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_activity_status_changed();

-- =====================================================================
-- 6) Cadastro aprovado / reprovado (worker_profiles.status)
--    Dispara apenas para motoristas (subtype takeme/partner).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.notify_driver_account_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.subtype IS NULL OR NEW.subtype NOT IN ('takeme', 'partner') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
    VALUES (
      NEW.id,
      'Cadastro aprovado',
      'Seu cadastro foi aprovado. Você já pode receber solicitações e iniciar viagens.',
      'account_approved',
      'motorista',
      jsonb_build_object('route', 'Main')
    );
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
    VALUES (
      NEW.id,
      'Cadastro de motorista reprovado',
      'Seu cadastro não foi aprovado nesta análise. Entre em contato com o suporte para saber mais.',
      'account_rejected',
      'motorista',
      jsonb_build_object('route', 'MotoristaPendingApproval')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_driver_account_status_change ON public.worker_profiles;
CREATE TRIGGER trg_notify_driver_account_status_change
  AFTER UPDATE OF status ON public.worker_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_account_status_change();

-- =====================================================================
-- 7) Pagamento recebido (payouts.status -> paid)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.notify_driver_payment_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount_brl text;
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

  v_amount_brl := 'R$ ' || to_char(
    (COALESCE(NEW.worker_amount_cents, 0)::numeric / 100.0),
    'FM999G999G990D00'
  );

  INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
  VALUES (
    NEW.worker_id,
    'Você recebeu um pagamento',
    format('Repasse de %s confirmado. Confira em Pagamentos.', v_amount_brl),
    'payment_received',
    'motorista',
    jsonb_build_object('route', 'PaymentHistory')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_driver_payment_received ON public.payouts;
CREATE TRIGGER trg_notify_driver_payment_received
  AFTER UPDATE OF status ON public.payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_driver_payment_received();

-- =====================================================================
-- Ajuste dos dois triggers já existentes para também respeitar preferência
-- e passar a incluir `data` para deeplink (mantém target_app_slug = motorista).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.notify_driver_new_booking_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  drv uuid;
  daddr text;
BEGIN
  IF NEW.status IS NULL OR NEW.status NOT IN ('pending', 'paid') THEN
    RETURN NEW;
  END IF;

  SELECT st.driver_id, st.destination_address
  INTO drv, daddr
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
    'Nova solicitação de reserva',
    format(
      'Passageiro pediu vaga: %s → %s. Abra Solicitações pendentes para aceitar ou recusar.',
      left(coalesce(NEW.origin_address, 'origem'), 80),
      left(coalesce(NEW.destination_address, daddr, 'destino'), 80)
    ),
    'travel_updates',
    'motorista',
    jsonb_build_object('route', 'PendingRequests')
  );

  RETURN NEW;
END;
$$;

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

  IF NEW.base_id IS NOT NULL THEN
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

  RETURN NEW;
END;
$$;
