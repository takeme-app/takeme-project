-- Sua tabela não tinha preference_area (a edge envia no INSERT).
-- cnh_document_back_url: app atualiza após cadastro; deixe disponível.
alter table public.worker_profiles add column if not exists preference_area text;
alter table public.worker_profiles add column if not exists cnh_document_back_url text;

-- created_at / updated_at NOT NULL: garante default se algum cliente não mandar timestamp
alter table public.worker_profiles alter column created_at set default now();
alter table public.worker_profiles alter column updated_at set default now();
