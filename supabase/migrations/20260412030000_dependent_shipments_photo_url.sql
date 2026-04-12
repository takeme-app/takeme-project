-- Adicionar coluna photo_url à tabela dependent_shipments (mesmo padrão de shipments)
ALTER TABLE public.dependent_shipments ADD COLUMN IF NOT EXISTS photo_url text;
