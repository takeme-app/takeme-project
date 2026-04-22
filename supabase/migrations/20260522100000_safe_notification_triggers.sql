-- Torna os triggers de notificação tolerantes a falha.
-- Motivo: erros secundários (ex.: coluna inexistente em `notifications`, falha em
-- `should_notify_user`, schema drift em `notification_preferences`) estavam
-- abortando a transação principal — causando o sintoma
-- "Pagamento autorizado, mas não foi possível registrar a reserva" em
-- charge-booking (insert em bookings) e erros equivalentes em shipments
-- /dependent_shipments quando o status é atualizado.
--
-- Regra: a notificação é best-effort; não pode derrubar o pagamento/fluxo.
--
-- Também reforça que `notifications.data` e `notifications.target_app_slug`
-- existam antes dos triggers que os populam (idempotente).

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS data jsonb NULL;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target_app_slug text;

UPDATE public.notifications
  SET target_app_slug = 'cliente'
  WHERE target_app_slug IS NULL;

ALTER TABLE public.notifications
  ALTER COLUMN target_app_slug SET DEFAULT 'cliente';

ALTER TABLE public.notifications
  ALTER COLUMN target_app_slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND constraint_name = 'notifications_target_app_slug_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_target_app_slug_check
      CHECK (target_app_slug IN ('cliente', 'motorista'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Nova solicitação de reserva (motorista)
-- ---------------------------------------------------------------------------
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

  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_driver_new_booking_request] ignorado: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Nova encomenda na viagem do motorista
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3) Viagem em andamento (scheduled_trips.driver_journey_started_at)
-- ---------------------------------------------------------------------------
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_driver_trip_started] ignorado: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Viagem finalizada / fechada (scheduled_trips.status / seats_available)
-- ---------------------------------------------------------------------------
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

  BEGIN
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
          NEW.driver_id, v_title, v_message, v_category, 'motorista',
          jsonb_build_object('route', v_route, 'params', jsonb_build_object('tripId', NEW.id))
        );
      END IF;
    END IF;

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
          NEW.driver_id, v_title, v_message, v_category, 'motorista',
          jsonb_build_object('route', v_route, 'params', jsonb_build_object('tripId', NEW.id))
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_driver_trip_lifecycle] ignorado: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Atividade mudou de status (bookings/shipments/dependent_shipments)
-- ---------------------------------------------------------------------------
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_driver_activity_status_changed] ignorado: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Conta aprovada / reprovada (worker_profiles.status)
-- ---------------------------------------------------------------------------
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

  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_driver_account_status_change] ignorado: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) Pagamento recebido (payouts.status -> paid)
-- ---------------------------------------------------------------------------
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

  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_driver_payment_received] ignorado: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8) Motorista iniciou a viagem — notificar passageiros/clientes (cliente)
-- ---------------------------------------------------------------------------
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

  BEGIN
    dest_preview := left(coalesce(NEW.destination_address, 'destino'), 100);

    INSERT INTO public.notifications (user_id, title, message, category, target_app_slug)
    SELECT DISTINCT
      u.uid,
      'Motorista a caminho',
      format('O motorista iniciou a viagem rumo a %s. Acompanhe no app.', dest_preview),
      'travel_updates',
      'cliente'
    FROM (
      SELECT b.user_id AS uid
      FROM public.bookings b
      WHERE b.scheduled_trip_id = NEW.id
        AND b.status IN ('paid', 'confirmed')
      UNION
      SELECT ds.user_id
      FROM public.dependent_shipments ds
      WHERE ds.scheduled_trip_id = NEW.id
        AND ds.status IN ('confirmed', 'in_progress')
      UNION
      SELECT s.user_id
      FROM public.shipments s
      WHERE s.scheduled_trip_id = NEW.id
        AND s.status IN ('confirmed', 'in_progress')
    ) u;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_passengers_driver_journey_started] ignorado: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_driver_new_booking_request() IS
  'Best-effort: qualquer falha secundária (ex.: schema drift em notifications/preferences) não deve abortar o insert de bookings.';
COMMENT ON FUNCTION public.notify_driver_shipment_on_trip() IS
  'Best-effort: não pode derrubar insert/update em shipments.';
COMMENT ON FUNCTION public.notify_driver_activity_status_changed() IS
  'Best-effort: não pode derrubar mudanças de status nas entidades.';
