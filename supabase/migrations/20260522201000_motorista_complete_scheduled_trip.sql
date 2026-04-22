-- Concluir viagem (status + anexos) via RPC: evita falhas de UPDATE em scheduled_trips
-- quando políticas RLS/PostgREST divergem do fluxo do app (ex.: comprovantes).

CREATE OR REPLACE FUNCTION public.motorista_complete_scheduled_trip(
  p_trip_id uuid,
  p_expense_paths text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_driver uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT st.driver_id
  INTO v_driver
  FROM public.scheduled_trips st
  WHERE st.id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_driver IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_your_trip');
  END IF;

  UPDATE public.scheduled_trips
  SET
    status = 'completed',
    is_active = false,
    driver_journey_started_at = NULL,
    driver_expense_paths = COALESCE(p_expense_paths, driver_expense_paths),
    updated_at = now()
  WHERE id = p_trip_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'server_error', 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.motorista_complete_scheduled_trip(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.motorista_complete_scheduled_trip(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.motorista_complete_scheduled_trip(uuid, text[]) TO service_role;

COMMENT ON FUNCTION public.motorista_complete_scheduled_trip(uuid, text[]) IS
  'Motorista autenticado marca scheduled_trip como concluída e opcionalmente grava paths de comprovantes (já enviados ao bucket trip-expenses).';
