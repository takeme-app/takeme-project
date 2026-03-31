-- Aceite/recusa de booking pelo motorista da viagem (RLS no UPDATE direto pode falhar em silêncio).
CREATE OR REPLACE FUNCTION public.driver_respond_booking(p_booking_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_id uuid;
  v_driver_id uuid;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT b.scheduled_trip_id, b.status
  INTO v_trip_id, v_status
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  IF v_trip_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  IF v_status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_pending', 'current_status', v_status);
  END IF;

  SELECT st.driver_id INTO v_driver_id
  FROM public.scheduled_trips st
  WHERE st.id = v_trip_id;

  IF v_driver_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_trip_driver');
  END IF;

  UPDATE public.bookings
  SET
    status = CASE WHEN p_accept THEN 'confirmed' ELSE 'cancelled' END,
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('ok', true, 'accepted', p_accept);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'exception', 'message', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.driver_respond_booking(uuid, boolean) IS
  'Motorista autenticado confirma ou cancela booking pendente da sua scheduled_trip.';

REVOKE ALL ON FUNCTION public.driver_respond_booking(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_respond_booking(uuid, boolean) TO authenticated;
