-- RLS batch 3 (21/abr/2026): pricing_routes.
-- Admin + worker policies já existem. Falta policy de cliente para apps/cliente/src/lib/shipmentQuote.ts
-- ler rotas ativas (necessário para cotação de envios).

DROP POLICY IF EXISTS "pricing_routes_client_read_active" ON public.pricing_routes;
CREATE POLICY "pricing_routes_client_read_active"
  ON public.pricing_routes FOR SELECT TO authenticated
  USING (is_active = true);

ALTER TABLE public.pricing_routes ENABLE ROW LEVEL SECURITY;
