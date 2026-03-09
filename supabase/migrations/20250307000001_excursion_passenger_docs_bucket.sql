-- Bucket privado para documentos e foto de passageiros de excursão.
-- Estrutura: excursion-passenger-docs/{user_id}/{excursion_request_id}/{passenger_id}/...
insert into storage.buckets (id, name, public)
values ('excursion-passenger-docs', 'excursion-passenger-docs', false)
on conflict (id) do update set public = false;

-- Políticas: usuário autenticado só acessa seus próprios arquivos (primeiro segmento = user_id).
drop policy if exists "Excursion passenger docs upload" on storage.objects;
create policy "Excursion passenger docs upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'excursion-passenger-docs' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Excursion passenger docs read" on storage.objects;
create policy "Excursion passenger docs read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'excursion-passenger-docs' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Excursion passenger docs update" on storage.objects;
create policy "Excursion passenger docs update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'excursion-passenger-docs' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Excursion passenger docs delete" on storage.objects;
create policy "Excursion passenger docs delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'excursion-passenger-docs' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
