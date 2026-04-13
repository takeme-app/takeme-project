-- Lista do app cliente: alinhar SELECT a support_requester_id (já usado em queries .or no RPC/app).
-- Sem isto, linhas visíveis só por support_requester_id podem falhar em RLS dependendo do histórico.

DROP POLICY IF EXISTS "conversations_select" ON public.conversations;

CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT TO authenticated
  USING (
    auth.uid() = driver_id
    OR auth.uid() = client_id
    OR auth.uid() = support_requester_id
  );
