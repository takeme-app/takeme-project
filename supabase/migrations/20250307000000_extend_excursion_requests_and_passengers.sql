-- Estende excursion_requests (valor, datas, status, equipe, orçamento) e cria excursion_passengers.
-- Status expandido: pending | in_analysis | quoted | approved | scheduled | in_progress | completed | cancelled.

alter table public.excursion_requests
  drop constraint if exists excursion_requests_status_check;

alter table public.excursion_requests
  add column if not exists total_amount_cents integer check (total_amount_cents is null or total_amount_cents >= 0),
  add column if not exists confirmed_at timestamptz,
  add column if not exists scheduled_departure_at timestamptz,
  add column if not exists sub_status text,
  add column if not exists driver_id uuid references auth.users (id) on delete set null,
  add column if not exists preparer_id uuid references auth.users (id) on delete set null,
  add column if not exists assignment_notes jsonb default '{}',
  add column if not exists vehicle_details jsonb,
  add column if not exists budget_lines jsonb default '[]',
  add column if not exists payment_method text check (payment_method is null or payment_method in ('credit_card', 'debit_card', 'pix', 'cash')),
  add column if not exists payment_method_id uuid references public.payment_methods (id) on delete set null;

alter table public.excursion_requests
  add constraint excursion_requests_status_check
  check (status in ('pending', 'contacted', 'quoted', 'cancelled', 'in_analysis', 'approved', 'scheduled', 'in_progress', 'completed'));

comment on column public.excursion_requests.total_amount_cents is 'Valor total em centavos (preenchido quando orçamento disponível).';
comment on column public.excursion_requests.confirmed_at is 'Data/hora de confirmação da excursão.';
comment on column public.excursion_requests.scheduled_departure_at is 'Saída prevista.';
comment on column public.excursion_requests.assignment_notes is 'Notas da designação: driver_note, preparer_note, preparer_role.';
comment on column public.excursion_requests.vehicle_details is 'Detalhes do veículo: model, license_plate, color, capacity, observation.';
comment on column public.excursion_requests.budget_lines is 'Linhas do orçamento: [{ "label": "...", "amount_cents": 25000 }, ...].';

-- Tabela de passageiros da excursão (cadastro e status ida/volta).
create table if not exists public.excursion_passengers (
  id uuid primary key default gen_random_uuid(),
  excursion_request_id uuid not null references public.excursion_requests (id) on delete cascade,
  full_name text not null,
  cpf text,
  phone text,
  age text,
  gender text,
  observations text,
  document_url text,
  guardian_document_url text,
  consent_document_url text,
  photo_url text,
  status_departure text default 'not_embarked' check (status_departure in ('not_embarked', 'embarked', 'disembarked')),
  status_return text default 'not_embarked' check (status_return in ('not_embarked', 'embarked', 'disembarked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_excursion_passengers_excursion_request_id on public.excursion_passengers (excursion_request_id);

alter table public.excursion_passengers enable row level security;

-- Usuário só acessa passageiros de excursões que pertencem a ele.
create policy "Users can view own excursion_passengers"
  on public.excursion_passengers for select
  using (
    exists (
      select 1 from public.excursion_requests er
      where er.id = excursion_passengers.excursion_request_id and er.user_id = auth.uid()
    )
  );

create policy "Users can insert own excursion_passengers"
  on public.excursion_passengers for insert
  with check (
    exists (
      select 1 from public.excursion_requests er
      where er.id = excursion_passengers.excursion_request_id and er.user_id = auth.uid()
    )
  );

create policy "Users can update own excursion_passengers"
  on public.excursion_passengers for update
  using (
    exists (
      select 1 from public.excursion_requests er
      where er.id = excursion_passengers.excursion_request_id and er.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.excursion_requests er
      where er.id = excursion_passengers.excursion_request_id and er.user_id = auth.uid()
    )
  );

create policy "Users can delete own excursion_passengers"
  on public.excursion_passengers for delete
  using (
    exists (
      select 1 from public.excursion_requests er
      where er.id = excursion_passengers.excursion_request_id and er.user_id = auth.uid()
    )
  );

comment on table public.excursion_passengers is 'Passageiros cadastrados por excursão; status por trecho (ida/volta).';
