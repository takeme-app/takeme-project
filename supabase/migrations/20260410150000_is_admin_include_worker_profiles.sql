-- Admin no painel costuma vir de worker_profiles (role = admin), sem app_metadata no JWT.
-- Amplia is_admin() para aceitar JWT OU perfil de trabalhador admin aprovado/pendente.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'admin',
    false
  )
  or coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role') = 'admin',
    false
  )
  or exists (
    select 1
    from public.worker_profiles wp
    where wp.id = auth.uid()
      and wp.role = 'admin'
      and wp.status in ('approved', 'pending')
  );
$$;

comment on function public.is_admin() is
  'True if JWT app/user_metadata.role=admin, or worker_profiles for auth.uid() has role=admin and status approved/pending.';
