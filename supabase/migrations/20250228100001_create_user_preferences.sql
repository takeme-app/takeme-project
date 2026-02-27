-- Preferências de UI por usuário (ex.: último filtro da tela Atividades) para sincronizar entre dispositivos.
create table if not exists public.user_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists idx_user_preferences_user_id on public.user_preferences (user_id);

alter table public.user_preferences enable row level security;

create policy "Users can view own user_preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own user_preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own user_preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.user_preferences is 'Chaves: activities_filter (category, dateStart, dateEnd), etc.';
