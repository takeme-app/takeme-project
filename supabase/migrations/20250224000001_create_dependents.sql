-- Dependentes do usuário (cadastro com documentos opcionais e status de validação).
create table if not exists public.dependents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null,
  age text,
  document_url text,
  representative_document_url text,
  observations text,
  status text not null default 'pending' check (status in ('pending', 'validated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dependents_user_id on public.dependents (user_id);

alter table public.dependents enable row level security;

create policy "Users can view own dependents"
  on public.dependents for select
  using (auth.uid() = user_id);

create policy "Users can insert own dependents"
  on public.dependents for insert
  with check (auth.uid() = user_id);

create policy "Users can update own dependents"
  on public.dependents for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own dependents"
  on public.dependents for delete
  using (auth.uid() = user_id);

comment on table public.dependents is 'Dependentes cadastrados pelo usuário; status pending/validated.';
