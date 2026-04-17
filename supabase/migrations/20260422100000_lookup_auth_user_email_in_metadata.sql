-- Inclui e-mail guardado só em metadados (auth.users.email vazio), ex.: cadastro por telefone
-- ou fluxos que gravaram o e-mail em raw_user_meta_data / raw_app_meta_data.

create or replace function public.lookup_auth_user_id_by_normalized_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from auth.users u
  where lower(trim(both from coalesce(u.email, '')))
          = lower(trim(both from coalesce(p_email, '')))
     or lower(trim(both from coalesce(u.raw_user_meta_data->>'email', '')))
          = lower(trim(both from coalesce(p_email, '')))
     or lower(trim(both from coalesce(u.raw_app_meta_data->>'email', '')))
          = lower(trim(both from coalesce(p_email, '')))
     or exists (
          select 1
          from auth.identities i
          where i.user_id = u.id
            and lower(trim(both from coalesce(i.identity_data->>'email', '')))
              = lower(trim(both from coalesce(p_email, '')))
        )
  limit 1;
$$;

comment on function public.lookup_auth_user_id_by_normalized_email(text) is
  'Usado pelas Edge Functions (service_role): localiza auth.users.id por e-mail em users.email, raw_user/app meta (email), ou identities.identity_data.email.';

revoke all on function public.lookup_auth_user_id_by_normalized_email(text) from public;
grant execute on function public.lookup_auth_user_id_by_normalized_email(text) to service_role;
