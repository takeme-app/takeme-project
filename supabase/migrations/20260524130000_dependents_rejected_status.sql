-- =====================================================================
-- Dependentes: adiciona status `rejected` + coluna `rejection_reason`.
--
-- Fase 5 das notificações (cliente - dependente). O admin poderá marcar
-- um dependente como reprovado informando o motivo; o trigger dedicado
-- (ver 20260524140000_*) dispara a notificação com o texto literal do
-- spec ("Dependente não aprovado!").
-- =====================================================================

ALTER TABLE public.dependents
  DROP CONSTRAINT IF EXISTS dependents_status_check;

ALTER TABLE public.dependents
  ADD CONSTRAINT dependents_status_check
  CHECK (status IN ('pending', 'validated', 'rejected'));

ALTER TABLE public.dependents
  ADD COLUMN IF NOT EXISTS rejection_reason text;

COMMENT ON COLUMN public.dependents.status IS
  'Situação de validação do dependente: pending (aguardando análise), validated (aprovado), rejected (reprovado).';
COMMENT ON COLUMN public.dependents.rejection_reason IS
  'Motivo informado pelo admin ao reprovar o cadastro (status = rejected).';
