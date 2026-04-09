-- Corrige visibilidade da fila na base: a subquery a worker_profiles dentro da política de shipments
-- pode não enxergar a linha do preparador por interação de RLS. Função SECURITY DEFINER
-- avalia o vínculo base + subtype shipments com o auth.uid() atual.

CREATE OR REPLACE FUNCTION public.worker_is_shipments_preparer_for_base(p_base_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.worker_profiles wp
    WHERE wp.id = auth.uid()
      AND wp.subtype = 'shipments'
      AND wp.base_id IS NOT NULL
      AND wp.base_id = p_base_id
  );
$$;

REVOKE ALL ON FUNCTION public.worker_is_shipments_preparer_for_base(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_is_shipments_preparer_for_base(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.worker_is_shipments_preparer_for_base(uuid) TO service_role;

COMMENT ON FUNCTION public.worker_is_shipments_preparer_for_base(uuid) IS
  'True se o usuário autenticado é preparador de encomendas (subtype shipments) vinculado à base.';

DROP POLICY IF EXISTS "drivers_can_view_shipments" ON public.shipments;
DROP POLICY IF EXISTS "drivers_can_update_shipments" ON public.shipments;

CREATE POLICY "drivers_can_view_shipments"
  ON public.shipments
  FOR SELECT
  USING (
    status = 'pending_review'
    OR driver_id = auth.uid()
    OR user_id = auth.uid()
    OR (
      driver_id IS NULL
      AND status = 'confirmed'
      AND base_id IS NOT NULL
      AND public.worker_is_shipments_preparer_for_base(shipments.base_id)
    )
  );

CREATE POLICY "drivers_can_update_shipments"
  ON public.shipments
  FOR UPDATE
  USING (
    status = 'pending_review'
    OR driver_id = auth.uid()
    OR (
      status = 'confirmed'
      AND driver_id IS NULL
      AND base_id IS NOT NULL
      AND public.worker_is_shipments_preparer_for_base(shipments.base_id)
    )
  );
