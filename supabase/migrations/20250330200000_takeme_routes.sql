-- Rotas padrão da TakeMe (definidas pelo admin).
-- Motoristas podem adotar estas rotas com um toggle no app.
create table if not exists public.takeme_routes (
  id uuid primary key default gen_random_uuid(),
  origin_address text not null,
  destination_address text not null,
  price_per_person_cents int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Apenas admins inserem/atualizam; qualquer autenticado pode ler.
alter table public.takeme_routes enable row level security;

create policy "takeme_routes_select_all"
  on public.takeme_routes for select
  to authenticated
  using (true);
