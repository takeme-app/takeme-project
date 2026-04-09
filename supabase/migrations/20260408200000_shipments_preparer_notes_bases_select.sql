-- Observações de coleta/entrega na base (telas do preparador)
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS pickup_notes text NULL,
  ADD COLUMN IF NOT EXISTS delivery_notes text NULL;

COMMENT ON COLUMN public.shipments.pickup_notes IS 'Observações do preparador ao confirmar coleta no cliente.';
COMMENT ON COLUMN public.shipments.delivery_notes IS 'Observações do preparador ao entregar na base.';

-- Bases: leitura para usuários autenticados (coordenadas/endereço no app do preparador)
ALTER TABLE public.bases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bases_select_authenticated_active" ON public.bases;
CREATE POLICY "bases_select_authenticated_active"
  ON public.bases
  FOR SELECT
  TO authenticated
  USING (is_active = true);
