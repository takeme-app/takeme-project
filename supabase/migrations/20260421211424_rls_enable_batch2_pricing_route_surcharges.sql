-- RLS batch 2 (21/abr/2026): pricing_route_surcharges.
-- Admin lê tudo (policy existente). Motorista/cliente consomem via join em pricing_routes.
-- Criamos policy que reaproveita a lógica de worker_can_read_pricing_route.

DROP POLICY IF EXISTS "pricing_route_surcharges_worker_read" ON public.pricing_route_surcharges;
CREATE POLICY "pricing_route_surcharges_worker_read"
  ON public.pricing_route_surcharges FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pricing_routes pr
      WHERE pr.id = pricing_route_surcharges.pricing_route_id
        AND (is_admin() OR public.worker_can_read_pricing_route(pr.role_type))
    )
  );

ALTER TABLE public.pricing_route_surcharges ENABLE ROW LEVEL SECURITY;
