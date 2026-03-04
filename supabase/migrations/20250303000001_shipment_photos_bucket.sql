-- Bucket para fotos da encomenda (envios). Privado; usuário autenticado upload em shipment-photos/{user_id}/...
insert into storage.buckets (id, name, public)
values ('shipment-photos', 'shipment-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "Shipment photos upload" on storage.objects;
create policy "Shipment photos upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shipment-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Shipment photos read" on storage.objects;
create policy "Shipment photos read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'shipment-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Shipment photos delete" on storage.objects;
create policy "Shipment photos delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'shipment-photos' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
