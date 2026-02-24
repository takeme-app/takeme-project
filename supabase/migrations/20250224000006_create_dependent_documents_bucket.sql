-- Bucket privado para documentos de dependentes (documento do dependente e do responsável).
-- As políticas de acesso estão em 20250224000004_storage_buckets.sql.
-- Estrutura no bucket: {user_id}/{dependent_id}/documento.pdf e .../responsavel.pdf
insert into storage.buckets (id, name, public)
values ('dependent-documents', 'dependent-documents', false)
on conflict (id) do update set public = false;
