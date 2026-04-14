-- Posição ao vivo do motorista durante viagem ativa (app motorista grava; app cliente assina Realtime).
-- Aplicada no projeto remoto via MCP (nome registado: scheduled_trip_live_locations).

create table if not exists public.scheduled_trip_live_locations (
  scheduled_trip_id uuid not null primary key references public.scheduled_trips (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  updated_at timestamptz not null default now()
);

comment on table public.scheduled_trip_live_locations is
  'Última posição GPS publicada pelo motorista para passageiros acompanharem a viagem (atualização periódica).';

create index if not exists idx_scheduled_trip_live_locations_updated_at
  on public.scheduled_trip_live_locations (updated_at desc);

alter table public.scheduled_trip_live_locations enable row level security;

-- Motorista da viagem: leitura, escrita e remoção da própria linha.
create policy "slt_live_driver_select"
  on public.scheduled_trip_live_locations for select to authenticated
  using (
    exists (
      select 1 from public.scheduled_trips st
      where st.id = scheduled_trip_live_locations.scheduled_trip_id
        and st.driver_id = auth.uid()
    )
  );

create policy "slt_live_driver_insert"
  on public.scheduled_trip_live_locations for insert to authenticated
  with check (
    exists (
      select 1 from public.scheduled_trips st
      where st.id = scheduled_trip_id and st.driver_id = auth.uid()
    )
  );

create policy "slt_live_driver_update"
  on public.scheduled_trip_live_locations for update to authenticated
  using (
    exists (
      select 1 from public.scheduled_trips st
      where st.id = scheduled_trip_live_locations.scheduled_trip_id
        and st.driver_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.scheduled_trips st
      where st.id = scheduled_trip_id and st.driver_id = auth.uid()
    )
  );

create policy "slt_live_driver_delete"
  on public.scheduled_trip_live_locations for delete to authenticated
  using (
    exists (
      select 1 from public.scheduled_trips st
      where st.id = scheduled_trip_live_locations.scheduled_trip_id
        and st.driver_id = auth.uid()
    )
  );

-- Passageiro com reserva na mesma viagem: apenas leitura.
create policy "slt_live_passenger_select"
  on public.scheduled_trip_live_locations for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.scheduled_trip_id = scheduled_trip_live_locations.scheduled_trip_id
        and b.user_id = auth.uid()
    )
  );

do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'scheduled_trip_live_locations') then
    null;
  else
    alter publication supabase_realtime add table public.scheduled_trip_live_locations;
  end if;
exception
  when undefined_object then
    raise notice 'supabase_realtime publication missing; skip add table';
end $$;
