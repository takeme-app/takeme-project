-- RLS batch 1 (21/abr/2026): tabelas com impacto mínimo.
-- Ver docs/RLS_AUDIT.md para detalhes.

-- dependent_shipment_ratings: policy admin existente basta (is_admin).
ALTER TABLE public.dependent_shipment_ratings ENABLE ROW LEVEL SECURITY;

-- status_history: policy admin existente basta (is_admin).
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

-- surcharge_catalog: admin lê tudo; cria policy p/ authenticated ler somente ativos
-- (usado indiretamente em joins `pricing_routes(*, pricing_route_surcharges(*, surcharge_catalog(*)))` pelo motorista/cliente).
DROP POLICY IF EXISTS "surcharge_catalog_authenticated_read_active" ON public.surcharge_catalog;
CREATE POLICY "surcharge_catalog_authenticated_read_active"
  ON public.surcharge_catalog FOR SELECT TO authenticated
  USING (is_active = true);
ALTER TABLE public.surcharge_catalog ENABLE ROW LEVEL SECURITY;
