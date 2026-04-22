-- Inserções em status_history a partir de triggers (ex.: scheduled_trips) correm
-- com o papel do cliente (authenticated). Com RLS ativa em status_history, o INSERT
-- falha. Esta função só é usada por triggers AFTER; SECURITY DEFINER + search_path
-- fixo permite gravar auditoria sem alargar políticas RLS aos clientes.

CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  etype text;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'bookings'             THEN etype := 'booking';
    WHEN 'shipments'            THEN etype := 'shipment';
    WHEN 'dependent_shipments'  THEN etype := 'dependent_shipment';
    WHEN 'excursion_requests'   THEN etype := 'excursion';
    WHEN 'scheduled_trips'      THEN etype := 'trip';
    ELSE etype := TG_TABLE_NAME;
  END CASE;

  IF TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.status_history (entity_type, entity_id, status, changed_at)
    VALUES (etype, NEW.id, NEW.status, now());
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.log_status_change() IS
  'Auditoria de status: SECURITY DEFINER para INSERT em status_history sob RLS; search_path fixo.';
