-- Clientes que possuem envio de dependente vinculado à scheduled_trip também precisam
-- ler a posição ao vivo do motorista (feature "Acompanhar em tempo real").
-- A policy existente `slt_live_passenger_select` exige booking na mesma viagem, o que
-- deixa o cliente de envio de dependente sem acesso e faz o mapa ficar parado.

drop policy if exists "slt_live_dependent_select" on public.scheduled_trip_live_locations;

create policy "slt_live_dependent_select"
  on public.scheduled_trip_live_locations for select to authenticated
  using (
    exists (
      select 1 from public.dependent_shipments ds
      where ds.scheduled_trip_id = scheduled_trip_live_locations.scheduled_trip_id
        and ds.user_id = auth.uid()
    )
  );
