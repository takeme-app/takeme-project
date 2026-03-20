-- =====================================================================
-- Driver Requests RLS
-- Permite que motoristas vejam e respondam solicitações (bookings,
-- shipments, excursion_requests) a eles direcionadas.
-- =====================================================================

-- -----------------------------------------------------------------------
-- 1. bookings — motorista vê reservas nas próprias scheduled_trips
-- -----------------------------------------------------------------------
create policy "drivers_can_view_trip_bookings"
  on public.bookings for select
  using (
    scheduled_trip_id in (
      select id from public.scheduled_trips where driver_id = auth.uid()
    )
    or user_id = auth.uid()
  );

create policy "drivers_can_update_trip_bookings"
  on public.bookings for update
  using (
    scheduled_trip_id in (
      select id from public.scheduled_trips where driver_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------
-- 2. shipments — adiciona driver_id + políticas de aceite/recusa
-- -----------------------------------------------------------------------
alter table public.shipments
  add column if not exists driver_id uuid references auth.users (id),
  add column if not exists driver_accepted_at timestamptz;

create policy "drivers_can_view_shipments"
  on public.shipments for select
  using (
    status = 'pending_review'
    or driver_id = auth.uid()
    or user_id = auth.uid()
  );

create policy "drivers_can_update_shipments"
  on public.shipments for update
  using (
    status = 'pending_review' or driver_id = auth.uid()
  );

-- -----------------------------------------------------------------------
-- 3. excursion_requests — adiciona driver_id + políticas de aceite/recusa
-- -----------------------------------------------------------------------
alter table public.excursion_requests
  add column if not exists driver_id uuid references auth.users (id),
  add column if not exists driver_accepted_at timestamptz;

create policy "drivers_can_view_excursion_requests"
  on public.excursion_requests for select
  using (
    status = 'pending'
    or driver_id = auth.uid()
    or user_id = auth.uid()
  );

create policy "drivers_can_update_excursion_requests"
  on public.excursion_requests for update
  using (
    status = 'pending' or driver_id = auth.uid()
  );
