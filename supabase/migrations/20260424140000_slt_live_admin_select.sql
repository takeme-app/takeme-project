-- Painel admin: ler última posição GPS publicada pelo motorista (Realtime + SELECT).
-- Antes só motorista e passageiros (reserva) tinham SELECT.

drop policy if exists "slt_live_admin_select" on public.scheduled_trip_live_locations;

create policy "slt_live_admin_select"
  on public.scheduled_trip_live_locations
  for select
  to authenticated
  using (public.is_admin());
