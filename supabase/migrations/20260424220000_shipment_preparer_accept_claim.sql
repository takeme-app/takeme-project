-- Preparador "aceita" a coleta na fila: não pode mais gravar em `driver_id`
-- (esse campo é do motorista após o fluxo motorista-primeiro).
-- Passamos a registrar `preparer_id` como "quem assumiu" na base.
--
-- A coluna `preparer_id` também existe em migrations posteriores (ex.: 20260526100000);
-- `IF NOT EXISTS` evita erro se já houver.

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS preparer_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.shipment_preparer_accept_claim(p_shipment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.shipments%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF s.base_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_base');
  END IF;
  IF NOT public.worker_is_shipments_preparer_for_base(s.base_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF s.driver_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'awaiting_driver');
  END IF;
  IF s.preparer_id IS NOT NULL AND s.preparer_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed');
  END IF;
  IF s.preparer_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  UPDATE public.shipments
  SET preparer_id = auth.uid()
  WHERE id = p_shipment_id
    AND preparer_id IS NULL;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.shipment_preparer_accept_claim(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shipment_preparer_accept_claim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shipment_preparer_accept_claim(uuid) TO service_role;

COMMENT ON FUNCTION public.shipment_preparer_accept_claim(uuid) IS
  'Preparador da base assume a coleta operacional: exige motorista já atribuído (driver_id) e grava preparer_id.';

-- Fila: envio já atribuído a outro preparador some da lista dos demais.
CREATE OR REPLACE FUNCTION public.preparer_shipment_queue()
RETURNS SETOF public.shipments
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM public.shipments s
  INNER JOIN public.worker_profiles wp
    ON wp.id = auth.uid()
   AND wp.subtype = 'shipments'
   AND wp.base_id IS NOT NULL
   AND wp.base_id = s.base_id
  WHERE s.driver_id IS NOT NULL
    AND s.status IN ('pending_review', 'confirmed')
    AND s.base_id IS NOT NULL
    AND (s.preparer_id IS NULL OR s.preparer_id = auth.uid())
  ORDER BY s.driver_accepted_at DESC NULLS LAST, s.created_at DESC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.preparer_shipment_queue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preparer_shipment_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.preparer_shipment_queue() TO service_role;

COMMENT ON FUNCTION public.preparer_shipment_queue() IS
  'Fila do preparador: mesma base, motorista já aceitou; visível a todos se preparer_id nulo, senão só ao preparador que assumiu.';
