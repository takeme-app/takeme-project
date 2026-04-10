-- Encerra ticket de suporte com nota; mesma regra de permissão que o UPDATE via RLS.
-- Depende de admin_may_update_support_conversation (migração support_atendimento_conversations).
CREATE OR REPLACE FUNCTION public.close_support_conversation(
  p_conversation_id uuid,
  p_finish_note text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  updated_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.admin_may_update_support_conversation(p_conversation_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.conversations
  SET
    status = 'closed',
    finish_note = NULLIF(trim(COALESCE(p_finish_note, '')), ''),
    finished_at = now(),
    updated_at = now()
  WHERE id = p_conversation_id
    AND conversation_kind = 'support_backoffice';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count = 0 THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.close_support_conversation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_support_conversation(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.close_support_conversation IS 'Operador autorizado encerra conversa de suporte e persiste finish_note.';
