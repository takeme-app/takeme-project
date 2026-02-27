-- Avaliações da viagem (1-5 estrelas + comentário opcional) feitas pelo passageiro após concluir.
create table if not exists public.booking_ratings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  rating smallint not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (booking_id)
);

create index if not exists idx_booking_ratings_booking_id on public.booking_ratings (booking_id);

alter table public.booking_ratings enable row level security;

-- Usuário só pode inserir avaliação para sua própria reserva
create policy "Users can insert rating for own booking"
  on public.booking_ratings for insert
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.user_id = auth.uid()
    )
  );

create policy "Users can view ratings for own bookings"
  on public.booking_ratings for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.user_id = auth.uid()
    )
  );

comment on table public.booking_ratings is 'Avaliação (1-5 estrelas e comentário) do passageiro após a viagem.';
