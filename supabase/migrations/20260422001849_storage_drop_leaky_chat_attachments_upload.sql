-- Remove a policy leaky `authenticated_upload_chat_attachments` que permitia qualquer usuário
-- autenticado fazer upload no bucket privado `chat-attachments`. Os callers legítimos
-- (apps motorista/cliente e painel admin após refatoração do FileUpload) já enviam com
-- caminho `${conversation_id}/...` e cobertos pelas policies:
--   - `chat_attachments insert participants` (driver_id/client_id, conversa ativa)
--   - `chat_attachments insert admin support` (admin em conversa support_backoffice)

DROP POLICY IF EXISTS "authenticated_upload_chat_attachments" ON storage.objects;
