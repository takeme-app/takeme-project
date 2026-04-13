-- Disponibilidade do admin (online/away/offline) para atribuição de tickets de suporte.

-- 1. Coluna de disponibilidade
ALTER TABLE public.worker_profiles
  ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'online'
  CHECK (availability IN ('online', 'away', 'offline'));

COMMENT ON COLUMN public.worker_profiles.availability IS 'Disponibilidade do admin para atendimento: online, away (ausente), offline.';

-- 2. RPC para atualizar disponibilidade (chamado pelo admin)
CREATE OR REPLACE FUNCTION public.update_admin_availability(p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_status NOT IN ('online', 'away', 'offline') THEN
    RAISE EXCEPTION 'invalid_status: must be online, away, or offline';
  END IF;

  UPDATE public.worker_profiles
  SET availability = p_status, updated_at = now()
  WHERE id = v_uid
    AND role = 'admin';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
END;
$$;

-- 3. Atualizar assign_support_agent para considerar disponibilidade
-- Prioridade: online > away. Se nenhum online, tenta away. Se nenhum, retorna NULL.
CREATE OR REPLACE FUNCTION public.assign_support_agent(p_conversation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_chosen uuid;
  v_existing uuid;
BEGIN
  SELECT admin_id INTO v_existing
  FROM public.conversations
  WHERE id = p_conversation_id;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Tentar agentes online primeiro
  WITH eligible AS (
    SELECT wp.id,
           (
             SELECT COUNT(*)::int
             FROM public.conversations cc
             WHERE cc.conversation_kind = 'support_backoffice'
               AND cc.status = 'active'
               AND cc.admin_id = wp.id
           ) AS active_cnt
    FROM public.worker_profiles wp
    WHERE wp.role = 'admin'
      AND wp.subtype = 'suporte'
      AND wp.status = 'approved'
      AND wp.availability = 'online'
  ),
  picked AS (
    SELECT e.id
    FROM eligible e
    WHERE e.active_cnt = (SELECT MIN(e2.active_cnt) FROM eligible e2)
    ORDER BY random()
    LIMIT 1
  )
  SELECT id INTO v_chosen FROM picked;

  -- Fallback: tentar agentes ausentes
  IF v_chosen IS NULL THEN
    WITH eligible_away AS (
      SELECT wp.id,
             (
               SELECT COUNT(*)::int
               FROM public.conversations cc
               WHERE cc.conversation_kind = 'support_backoffice'
                 AND cc.status = 'active'
                 AND cc.admin_id = wp.id
             ) AS active_cnt
      FROM public.worker_profiles wp
      WHERE wp.role = 'admin'
        AND wp.subtype = 'suporte'
        AND wp.status = 'approved'
        AND wp.availability = 'away'
    ),
    picked_away AS (
      SELECT e.id
      FROM eligible_away e
      WHERE e.active_cnt = (SELECT MIN(e2.active_cnt) FROM eligible_away e2)
      ORDER BY random()
      LIMIT 1
    )
    SELECT id INTO v_chosen FROM picked_away;
  END IF;

  -- Se nenhum disponível (todos offline), retorna NULL
  IF v_chosen IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.conversations
  SET admin_id = v_chosen,
      assigned_at = now(),
      updated_at = now()
  WHERE id = p_conversation_id
    AND conversation_kind = 'support_backoffice'
    AND admin_id IS NULL;

  RETURN v_chosen;
END;
$$;
