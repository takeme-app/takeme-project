-- Tokens FCM por perfil (app cliente / motorista no futuro). Upsert via RPC para permitir
-- reatribuir o mesmo token físico quando outro usuário faz login no aparelho.

create table if not exists public.profile_fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  fcm_token text not null,
  platform text not null default 'android'
    check (platform in ('android', 'ios', 'web')),
  app_slug text not null default 'cliente'
    check (app_slug in ('cliente', 'motorista')),
  updated_at timestamptz not null default now(),
  constraint profile_fcm_tokens_fcm_token_key unique (fcm_token)
);

create index if not exists idx_profile_fcm_tokens_profile
  on public.profile_fcm_tokens (profile_id);

create index if not exists idx_profile_fcm_tokens_profile_app
  on public.profile_fcm_tokens (profile_id, app_slug, platform);

comment on table public.profile_fcm_tokens is
  'Tokens FCM por perfil; atualizados pelo app após login/home. Edge de push lê com service role.';

alter table public.profile_fcm_tokens enable row level security;

create policy "Users select own profile fcm tokens"
  on public.profile_fcm_tokens for select
  using (auth.uid() = profile_id);

create policy "Users delete own profile fcm tokens"
  on public.profile_fcm_tokens for delete
  using (auth.uid() = profile_id);

-- Sem INSERT/UPDATE direto: troca de conta no mesmo aparelho exige security definer.

create or replace function public.upsert_profile_fcm_token(
  p_fcm_token text,
  p_platform text default 'android',
  p_app_slug text default 'cliente'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_fcm_token is null or length(trim(p_fcm_token)) = 0 then
    raise exception 'invalid fcm token';
  end if;
  insert into public.profile_fcm_tokens (profile_id, fcm_token, platform, app_slug, updated_at)
  values (auth.uid(), p_fcm_token, p_platform, p_app_slug, now())
  on conflict (fcm_token) do update set
    profile_id = auth.uid(),
    platform = excluded.platform,
    app_slug = excluded.app_slug,
    updated_at = now();
end;
$$;

comment on function public.upsert_profile_fcm_token(text, text, text) is
  'Associa o token FCM ao usuário autenticado (inclui reatribuição em troca de conta no aparelho).';

revoke all on function public.upsert_profile_fcm_token(text, text, text) from public;
grant execute on function public.upsert_profile_fcm_token(text, text, text) to authenticated;
