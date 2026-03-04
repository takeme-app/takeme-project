-- Solicitações de excursão (fluxo Excursões em Serviços/Início).
create table if not exists public.excursion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  destination text not null,
  excursion_date date not null,
  people_count integer not null default 1 check (people_count >= 1),
  fleet_type text not null check (fleet_type in ('carro', 'van', 'micro_onibus', 'onibus')),
  first_aid_team boolean not null default false,
  recreation_team boolean not null default false,
  children_team boolean not null default false,
  special_needs_team boolean not null default false,
  recreation_items jsonb not null default '[]',
  observations text,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'quoted', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_excursion_requests_user_id on public.excursion_requests (user_id);
create index if not exists idx_excursion_requests_created_at on public.excursion_requests (created_at desc);

alter table public.excursion_requests enable row level security;

create policy "Users can view own excursion_requests"
  on public.excursion_requests for select
  using (auth.uid() = user_id);

create policy "Users can insert own excursion_requests"
  on public.excursion_requests for insert
  with check (auth.uid() = user_id);

create policy "Users can update own excursion_requests"
  on public.excursion_requests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.excursion_requests is 'Solicitações de orçamento de excursão; status pending/contacted/quoted/cancelled.';
