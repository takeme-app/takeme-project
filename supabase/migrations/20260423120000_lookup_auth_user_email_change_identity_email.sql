-- auth.users.email_change: novo e-mail aguardando confirmação (painel pode destacar esse endereço).
-- auth.identities.email: coluna gerada (lower(identity_data->>'email')) no GoTrue — reforça o match.

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
     or lower(trim(both from coalesce(u.email_change, '')))
          = lower(trim(both from coalesce(p_email, '')))
     or lower(trim(both from coalesce(u.raw_user_meta_data->>'email', '')))
          = lower(trim(both from coalesce(p_email, '')))
     or lower(trim(both from coalesce(u.raw_app_meta_data->>'email', '')))
          = lower(trim(both from coalesce(p_email, '')))
     or exists (
          select 1
          from auth.identities i
          where i.user_id = u.id
            and (
              lower(trim(both from coalesce(i.identity_data->>'email', '')))
                = lower(trim(both from coalesce(p_email, '')))
              or trim(both from coalesce(i.email, ''))
                   = lower(trim(both from coalesce(p_email, '')))
            )
        )
  limit 1;
$$;

comment on function public.lookup_auth_user_id_by_normalized_email(text) is
  'Localiza auth.users.id por e-mail: users.email, email_change, meta, identities (identity_data.email e identities.email).';

revoke all on function public.lookup_auth_user_id_by_normalized_email(text) from public;
grant execute on function public.lookup_auth_user_id_by_normalized_email(text) to service_role;
