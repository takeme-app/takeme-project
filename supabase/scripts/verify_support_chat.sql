-- Execução manual (SQL editor / psql): validar fila de atendimento e mensagens.
-- Substitua os literais UUID abaixo pelos IDs de teste.

-- 1) Ticket de suporte do utilizador (motorista ou cliente que abriu ticket)
SELECT id, conversation_kind, category, status, driver_id, client_id, support_requester_id,
       last_message, last_message_at, unread_driver, unread_client, created_at
FROM public.conversations
WHERE conversation_kind = 'support_backoffice'
  AND (
    driver_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR client_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR support_requester_id = '00000000-0000-0000-0000-000000000001'::uuid
  )
ORDER BY last_message_at DESC NULLS LAST
LIMIT 10;

-- 2) Mensagens do ticket aberto no admin (URL /atendimentos/:id)
SELECT id, conversation_id, sender_id, left(content, 80) AS content_preview, created_at, read_at
FROM public.messages
WHERE conversation_id = '00000000-0000-0000-0000-000000000002'::uuid
ORDER BY created_at ASC;
