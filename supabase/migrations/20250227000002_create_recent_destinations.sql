-- Destinos recentes por usuário (sincronização entre dispositivos).
create table if not exists public.recent_destinations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  address text not null,
  city text not null,
  latitude double precision,
  longitude double precision,
  used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_recent_destinations_user_id on public.recent_destinations (user_id);
create index if not exists idx_recent_destinations_used_at on public.recent_destinations (user_id, used_at desc);

alter table public.recent_destinations enable row level security;

create policy "Users can view own recent_destinations"
  on public.recent_destinations for select
  using (auth.uid() = user_id);

create policy "Users can insert own recent_destinations"
  on public.recent_destinations for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own recent_destinations"
  on public.recent_destinations for delete
  using (auth.uid() = user_id);

comment on table public.recent_destinations is 'Histórico de destinos por usuário (substitui/complementa AsyncStorage).';
