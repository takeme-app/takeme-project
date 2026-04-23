-- =====================================================================
-- Notificações do passageiro (cliente) ligadas a eventos de viagem.
--
-- Escopo desta migration (Fase 2 do plano de notificações):
--
--   1) "Motorista a caminho"                    (ajuste: target_app_slug + data)
--   2) "Sua viagem está em andamento."          (bookings: paid -> confirmed)
--   3) "Você chegou ao destino."                (bookings: confirmed -> paid)
--   4) "Sua atividade de XXX mudou de status."  (bookings / shipments /
--      dependent_shipments / excursion_requests)
--
-- Observações:
--   - Todas inserem em public.notifications com target_app_slug='cliente' e
--     payload `data` para deeplink no app cliente.
--   - Transições tratadas especificamente (2 e 3) são ignoradas pelo trigger
--     genérico (4) para não gerar duas notificações do mesmo evento.
--   - `public.should_notify_user` respeita preferência fcm_and_inbox; se
--     retornar FALSE, a linha em `notifications` nem é criada (sem push e
--     sem caixa de entrada).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Ajuste de "Motorista a caminho": agora preenche target_app_slug e data
--    (sem alterar a semântica; o disparo ainda ocorre em driver_journey_started_at).
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

  -- Passageiros (bookings)
  INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
  SELECT
    b.user_id,
    'Motorista a caminho',
    format('O motorista iniciou a viagem rumo a %s. Acompanhe no app.', dest_preview),
    'travel_updates',
    'cliente',
    jsonb_build_object(
      'route', 'DriverOnTheWay',
      'params', jsonb_build_object('tripId', NEW.id, 'bookingId', b.id)
    )
  FROM public.bookings b
  WHERE b.scheduled_trip_id = NEW.id
    AND b.status IN ('paid', 'confirmed');

  -- Envios de dependente
  INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
  SELECT
    ds.user_id,
    'Motorista a caminho',
    format('O motorista iniciou a viagem rumo a %s. Acompanhe no app.', dest_preview),
    'travel_updates',
    'cliente',
    jsonb_build_object(
      'route', 'DependentShipmentDetail',
      'params', jsonb_build_object('dependentShipmentId', ds.id)
    )
  FROM public.dependent_shipments ds
  WHERE ds.scheduled_trip_id = NEW.id
    AND ds.status IN ('confirmed', 'in_progress');

  -- Encomendas
  INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
  SELECT
    s.user_id,
    'Motorista a caminho',
    format('O motorista iniciou a viagem rumo a %s. Acompanhe no app.', dest_preview),
    'shipments_deliveries',
    'cliente',
    jsonb_build_object(
      'route', 'ShipmentDetail',
      'params', jsonb_build_object('shipmentId', s.id)
    )
  FROM public.shipments s
  WHERE s.scheduled_trip_id = NEW.id
    AND s.status IN ('confirmed', 'in_progress');

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 2) e 3) Fases da viagem no booking (pickup / delivery)
--
-- Regras:
--   - paid -> confirmed  (motorista acabou de confirmar a coleta/embarque):
--       "Sua viagem está em andamento."
--   - confirmed -> paid  (motorista acabou de confirmar a entrega/desembarque):
--       "Você chegou ao destino."
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_client_booking_phase_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_trip uuid;
BEGIN
  v_user := NEW.user_id;
  v_trip := NEW.scheduled_trip_id;

  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;

  -- Embarque / início da corrida
  IF OLD.status = 'paid' AND NEW.status = 'confirmed' THEN
    IF public.should_notify_user(v_user, 'travel_updates') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_user,
        'Sua viagem está em andamento.',
        'Boa viagem! Acompanhe o trajeto em tempo real pelo app.',
        'travel_updates',
        'cliente',
        jsonb_build_object(
          'route', 'TripInProgress',
          'params', jsonb_build_object('tripId', v_trip, 'bookingId', NEW.id)
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  -- Desembarque / fim da corrida
  IF OLD.status = 'confirmed' AND NEW.status = 'paid' THEN
    IF public.should_notify_user(v_user, 'travel_updates') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_user,
        'Você chegou ao destino.',
        'Viagem concluída. Toque para avaliar sua corrida.',
        'travel_updates',
        'cliente',
        jsonb_build_object(
          'route', 'RateTrip',
          'params', jsonb_build_object('bookingId', NEW.id)
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_client_booking_phase_change ON public.bookings;
CREATE TRIGGER trg_notify_client_booking_phase_change
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_booking_phase_change();

-- ---------------------------------------------------------------------
-- 4) "Sua atividade de XXX mudou de status."
--
-- Espelha o trigger do motorista (notify_driver_activity_status_changed),
-- mas direcionado ao cliente (dono da reserva/encomenda/excursão) e com
-- preservação das transições já cobertas por notificações específicas.
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

    -- Evita duplicar:
    --   * pending -> paid/confirmed é "nova solicitação" (cliente já avisado no checkout)
    --   * paid -> confirmed é "viagem em andamento" (trigger específico acima)
    --   * confirmed -> paid é "chegou ao destino" (trigger específico acima)
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

    -- Transições já cobertas por notificações específicas do fluxo de encomenda
    -- (confirm-code emite "Coleta confirmada" / "Entrega confirmada" hoje;
    -- serão substituídas na Fase 4 por mensagens com o texto literal do spec).
    IF OLD.status = 'confirmed' AND NEW.status = 'in_progress' THEN
      RETURN NEW;
    END IF;
    IF OLD.status = 'in_progress' AND NEW.status = 'delivered' THEN
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'dependent_shipments' THEN
    v_user := NEW.user_id;
    v_entity_label := 'envio de dependente';
    v_category := 'dependents';
    v_route := 'DependentShipmentDetail';
    v_params := jsonb_build_object('dependentShipmentId', NEW.id);

    -- Mesma lógica acima para o fluxo de envio de dependente (Fase 5 substitui
    -- o insert do confirm-code pelo texto do spec).
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
    format('Sua atividade de %s mudou de status.', v_entity_label),
    format('Novo status: %s. Toque para ver detalhes.', coalesce(NEW.status, 'desconhecido')),
    v_category,
    'cliente',
    jsonb_build_object('route', v_route, 'params', v_params)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_client_activity_bookings ON public.bookings;
CREATE TRIGGER trg_notify_client_activity_bookings
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_activity_status_changed();

DROP TRIGGER IF EXISTS trg_notify_client_activity_shipments ON public.shipments;
CREATE TRIGGER trg_notify_client_activity_shipments
  AFTER UPDATE OF status ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_activity_status_changed();

DROP TRIGGER IF EXISTS trg_notify_client_activity_dependent_shipments ON public.dependent_shipments;
CREATE TRIGGER trg_notify_client_activity_dependent_shipments
  AFTER UPDATE OF status ON public.dependent_shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_activity_status_changed();

DROP TRIGGER IF EXISTS trg_notify_client_activity_excursion_requests ON public.excursion_requests;
CREATE TRIGGER trg_notify_client_activity_excursion_requests
  AFTER UPDATE OF status ON public.excursion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_activity_status_changed();

COMMENT ON FUNCTION public.notify_client_booking_phase_change() IS
  'Dispara notificações de fase da viagem para o passageiro: "Sua viagem está em andamento" (paid -> confirmed) e "Você chegou ao destino" (confirmed -> paid).';

COMMENT ON FUNCTION public.notify_client_activity_status_changed() IS
  'Notifica o cliente quando o status de uma atividade (viagem, encomenda, envio de dependente, excursão) muda, exceto transições já cobertas por triggers específicos.';
