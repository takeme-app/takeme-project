-- =====================================================================
-- Notificações de encomenda para o cliente (Fase 4).
--
-- Textos do spec (literal):
--   - "Encomenda em andamento ao destino!"   (shipments: confirmed -> in_progress)
--   - "Encomenda chegou ao destino!"         (shipments: in_progress -> delivered)
--
-- Também alinha o trigger genérico `notify_client_activity_status_changed`
-- ao texto literal do spec (seção "Notificações de Status"):
--   Título: "Sua atividade de XXX mudou de status"
--   Corpo : "Sua (*viagem, *encomenda, *excursão, *dependente) tem uma nova
--            atualização, clique e verifique."
--
-- Observações:
--   - Os filtros já existentes em notify_client_activity_status_changed
--     continuam suprimindo transições cobertas por triggers específicos
--     (fases 2/4/5) para evitar duplicação de push.
--   - Para `dependent_shipments`, o confirm-code ainda mantém seu insert
--     atual ("A coleta/entrega do seu dependente foi confirmada.") até a
--     Fase 5; a supressão das transições confirmed->in_progress /
--     in_progress->delivered continua ativa no trigger genérico.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Fases da encomenda (pickup / delivery) — texto literal do spec
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_client_shipment_phase_change()
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

  -- Coleta confirmada — encomenda começou a ir ao destino
  IF OLD.status = 'confirmed' AND NEW.status = 'in_progress' THEN
    IF public.should_notify_user(v_user, 'shipments_deliveries') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_user,
        'Encomenda em andamento ao destino!',
        'Sua encomenda foi coletada e está a caminho. Acompanhe no app.',
        'shipments_deliveries',
        'cliente',
        jsonb_build_object(
          'route', 'ShipmentDetail',
          'params', jsonb_build_object('shipmentId', NEW.id)
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  -- Entrega confirmada — encomenda chegou ao destino
  IF OLD.status = 'in_progress' AND NEW.status = 'delivered' THEN
    IF public.should_notify_user(v_user, 'shipments_deliveries') THEN
      INSERT INTO public.notifications (user_id, title, message, category, target_app_slug, data)
      VALUES (
        v_user,
        'Encomenda chegou ao destino!',
        'Sua encomenda foi entregue. Toque para ver os detalhes.',
        'shipments_deliveries',
        'cliente',
        jsonb_build_object(
          'route', 'ShipmentDetail',
          'params', jsonb_build_object('shipmentId', NEW.id)
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_client_shipment_phase_change ON public.shipments;
CREATE TRIGGER trg_notify_client_shipment_phase_change
  AFTER UPDATE OF status ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_shipment_phase_change();

-- ---------------------------------------------------------------------
-- 2) Alinha o trigger genérico ao texto literal do spec (seção Status).
--    A lógica de supressão de transições permanece idêntica à definida
--    na Fase 2 (ver 20260523140000_*).
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

    -- Transições já cobertas por triggers específicos ou pelo checkout inicial.
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

    -- Cobertas pelo notify_client_shipment_phase_change (Fase 4).
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

    -- Suprimidas até a Fase 5 substituir o insert do confirm-code.
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

COMMENT ON FUNCTION public.notify_client_shipment_phase_change() IS
  'Dispara notificações literais do spec para a encomenda do cliente: "Encomenda em andamento ao destino!" (confirmed -> in_progress) e "Encomenda chegou ao destino!" (in_progress -> delivered).';
