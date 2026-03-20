-- Bucket driver-documents sem policies no painel (0 policies) → upload falha com RLS.
-- O app usa role authenticated; políticas só em "public" não cobrem o JWT do motorista.
-- lower(bucket_id): painel pode mostrar DRIVER-DOCUMENTS mas o id costuma ser driver-documents.

insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Driver docs upload" on storage.objects;
create policy "Driver docs upload"
  on storage.objects for insert to authenticated
  with check (
    lower(bucket_id::text) = 'driver-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "Driver docs read" on storage.objects;
create policy "Driver docs read"
  on storage.objects for select to authenticated
  using (
    lower(bucket_id::text) = 'driver-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "Driver docs update" on storage.objects;
create policy "Driver docs update"
  on storage.objects for update to authenticated
  using (
    lower(bucket_id::text) = 'driver-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    lower(bucket_id::text) = 'driver-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "Driver docs delete" on storage.objects;
create policy "Driver docs delete"
  on storage.objects for delete to authenticated
  using (
    lower(bucket_id::text) = 'driver-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );
