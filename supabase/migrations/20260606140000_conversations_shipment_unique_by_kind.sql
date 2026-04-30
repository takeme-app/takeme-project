-- Antes: um único índice impedia dois chats activos com o mesmo shipment_id (qualquer conversation_kind).
-- Isso bloqueava ticket support_backoffice quando já existia conversa operacional preparador/cliente no mesmo envio.

DROP INDEX IF EXISTS public.conversations_one_active_per_shipment;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_one_active_driver_client_shipment
  ON public.conversations (shipment_id)
  WHERE shipment_id IS NOT NULL
    AND status = 'active'
    AND conversation_kind = 'driver_client';

CREATE UNIQUE INDEX IF NOT EXISTS conversations_one_active_support_shipment
  ON public.conversations (shipment_id)
  WHERE shipment_id IS NOT NULL
    AND status = 'active'
    AND conversation_kind = 'support_backoffice';

COMMENT ON INDEX public.conversations_one_active_driver_client_shipment IS
  'No máximo uma conversa motorista/preparador↔cliente activa por envio.';

COMMENT ON INDEX public.conversations_one_active_support_shipment IS
  'No máximo um ticket de suporte activo por envio.';
