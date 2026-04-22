-- Aceitar/recusar reserva na UI «Solicitações pendentes» sem depender só de RLS em UPDATE direto.
-- Evita falhas quando políticas ou WITH CHECK divergem do esperado.

CREATE OR REPLACE FUNCTION public.motorista_respond_booking_request(
  p_booking_id uuid,
  p_accept boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trip uuid;
  v_driver uuid;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT b.scheduled_trip_id, b.status
  INTO v_trip, v_status
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT st.driver_id
  INTO v_driver
  FROM public.scheduled_trips st
  WHERE st.id = v_trip;

  IF v_driver IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_your_trip');
  END IF;

  IF v_status IS NULL OR v_status NOT IN ('pending', 'paid') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status', 'detail', coalesce(v_status, ''));
  END IF;

  IF p_accept THEN
    UPDATE public.bookings b
    SET
      status = 'confirmed',
      updated_at = now(),
      paid_at = coalesce(b.paid_at, now())
    WHERE b.id = p_booking_id;
  ELSE
    UPDATE public.bookings b
    SET
      status = 'cancelled',
      updated_at = now()
    WHERE b.id = p_booking_id;
  END IF;

  IF p_accept THEN
    UPDATE public.worker_assignments wa
    SET status = 'accepted'
    WHERE wa.entity_type = 'booking'
      AND wa.entity_id = p_booking_id
      AND wa.worker_id = v_uid
      AND wa.status = 'assigned';
  ELSE
    UPDATE public.worker_assignments wa
    SET
      status = 'rejected',
      rejected_at = now(),
      rejection_reason = 'Recusado pelo motorista'
    WHERE wa.entity_type = 'booking'
      AND wa.entity_id = p_booking_id
      AND wa.worker_id = v_uid
      AND wa.status = 'assigned';
  END IF;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'server_error', 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.motorista_respond_booking_request(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.motorista_respond_booking_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.motorista_respond_booking_request(uuid, boolean) TO service_role;

COMMENT ON FUNCTION public.motorista_respond_booking_request(uuid, boolean) IS
  'Motorista autenticado confirma ou cancela booking pendente/pago da própria scheduled_trip; atualiza worker_assignments quando existir.';
