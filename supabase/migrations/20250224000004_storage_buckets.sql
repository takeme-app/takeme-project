-- Políticas de storage para avatares e documentos de dependentes.
-- Crie os buckets "avatars" (público) e "dependent-documents" (privado) no Dashboard se ainda não existirem.
-- Avatares: usuário autenticado faz upload em avatars/{user_id}/...
drop policy if exists "Profile avatars upload" on storage.objects;
create policy "Profile avatars upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Profile avatars read" on storage.objects;
create policy "Profile avatars read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Profile avatars update" on storage.objects;
create policy "Profile avatars update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Profile avatars delete" on storage.objects;
create policy "Profile avatars delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Documentos de dependentes: dependent-documents/{user_id}/...
drop policy if exists "Dependent docs upload" on storage.objects;
create policy "Dependent docs upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'dependent-documents' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Dependent docs read" on storage.objects;
create policy "Dependent docs read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'dependent-documents' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Dependent docs update" on storage.objects;
create policy "Dependent docs update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'dependent-documents' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Dependent docs delete" on storage.objects;
create policy "Dependent docs delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'dependent-documents' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
