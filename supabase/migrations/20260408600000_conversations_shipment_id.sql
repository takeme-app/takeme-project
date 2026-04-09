-- Liga conversa ao envio (coleta preparador ↔ cliente); uma conversa ativa por encomenda
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_one_active_per_shipment
  ON public.conversations (shipment_id)
  WHERE shipment_id IS NOT NULL AND status = 'active';

COMMENT ON COLUMN public.conversations.shipment_id IS 'Envio (shipments) associado ao chat do preparador de encomendas com o cliente.';
