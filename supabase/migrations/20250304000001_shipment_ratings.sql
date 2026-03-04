-- Avaliações do envio (1-5 estrelas + comentário opcional), uma por envio.
create table if not exists public.shipment_ratings (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  rating smallint not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (shipment_id)
);

create index if not exists idx_shipment_ratings_shipment_id on public.shipment_ratings (shipment_id);

alter table public.shipment_ratings enable row level security;

-- Usuário só pode inserir/atualizar avaliação para seu próprio envio
create policy "Users can insert rating for own shipment"
  on public.shipment_ratings for insert
  with check (
    exists (
      select 1 from public.shipments s
      where s.id = shipment_id and s.user_id = auth.uid()
    )
  );

create policy "Users can update rating for own shipment"
  on public.shipment_ratings for update
  using (
    exists (
      select 1 from public.shipments s
      where s.id = shipment_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.shipments s
      where s.id = shipment_id and s.user_id = auth.uid()
    )
  );

create policy "Users can view ratings for own shipments"
  on public.shipment_ratings for select
  using (
    exists (
      select 1 from public.shipments s
      where s.id = shipment_id and s.user_id = auth.uid()
    )
  );

comment on table public.shipment_ratings is 'Avaliação (1-5 estrelas e comentário) do cliente após o envio.';
