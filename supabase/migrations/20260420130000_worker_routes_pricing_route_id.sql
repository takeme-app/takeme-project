-- FK para rastrear de qual template admin a rota do worker veio.
ALTER TABLE public.worker_routes
  ADD COLUMN IF NOT EXISTS pricing_route_id uuid REFERENCES public.pricing_routes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.worker_routes.pricing_route_id IS 'Template admin de onde esta rota foi importada (NULL se criada do zero).';
