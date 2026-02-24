-- Garante policy de update para documentos de dependentes (upsert ao substituir arquivo).
drop policy if exists "Dependent docs update" on storage.objects;
create policy "Dependent docs update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'dependent-documents' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
