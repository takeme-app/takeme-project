-- Workers podem ler pricing_routes filtrado pelo seu role_type.
-- Motoristas (takeme/partner) leem role_type='driver'.
-- Preparadores de encomendas leem role_type='preparer_shipments'.
-- Preparadores de excursões leem role_type='preparer_excursions'.

CREATE OR REPLACE FUNCTION public.worker_can_read_pricing_route(p_role_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_subtype text;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  SELECT subtype INTO v_subtype FROM public.worker_profiles WHERE id = v_uid LIMIT 1;
  IF v_subtype IS NULL THEN RETURN false; END IF;
  -- Motoristas leem rotas de driver
  IF p_role_type = 'driver' AND v_subtype IN ('takeme', 'partner') THEN RETURN true; END IF;
  -- Preparadores de encomendas
  IF p_role_type = 'preparer_shipments' AND v_subtype = 'shipments' THEN RETURN true; END IF;
  -- Preparadores de excursões
  IF p_role_type = 'preparer_excursions' AND v_subtype = 'excursions' THEN RETURN true; END IF;
  RETURN false;
END;
$$;

CREATE POLICY pricing_routes_worker_read ON public.pricing_routes
  FOR SELECT USING (
    public.is_admin() OR public.worker_can_read_pricing_route(role_type)
  );
