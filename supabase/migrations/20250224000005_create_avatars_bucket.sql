-- Cria o bucket "avatars" (público) para fotos de perfil.
-- As políticas de acesso já estão em 20250224000004_storage_buckets.sql.
-- Se der erro (schema storage read-only), crie o bucket no Dashboard: Storage > New bucket > id: avatars, Public: on.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;
