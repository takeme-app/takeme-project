-- Admin read-only access: function + additive SELECT policies.
-- Uses app_metadata.role = 'admin' set via Supabase dashboard (Authentication → Users → Edit).
-- After setting the role, the user must re-login so the JWT refreshes.
-- These policies are OR'd with existing ones — they do NOT affect non-admin users.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

comment on function public.is_admin() is 'Returns true when the authenticated user has app_metadata.role = admin.';

-- profiles: admin can read all rows
create policy "Admin can read all profiles"
  on public.profiles for select
  using (public.is_admin());

-- scheduled_trips: admin can read ALL statuses (existing policy limits to active only)
create policy "Admin can read all scheduled_trips"
  on public.scheduled_trips for select
  using (public.is_admin());

-- bookings: admin can read all rows
create policy "Admin can read all bookings"
  on public.bookings for select
  using (public.is_admin());

-- shipments: admin can read all rows
create policy "Admin can read all shipments"
  on public.shipments for select
  using (public.is_admin());

-- dependent_shipments: admin can read all rows
create policy "Admin can read all dependent_shipments"
  on public.dependent_shipments for select
  using (public.is_admin());

-- excursion_requests: admin can read all rows
create policy "Admin can read all excursion_requests"
  on public.excursion_requests for select
  using (public.is_admin());

-- excursion_passengers: admin can read all rows
create policy "Admin can read all excursion_passengers"
  on public.excursion_passengers for select
  using (public.is_admin());

-- booking_ratings: admin can read all rows
create policy "Admin can read all booking_ratings"
  on public.booking_ratings for select
  using (public.is_admin());

-- shipment_ratings: admin can read all rows
create policy "Admin can read all shipment_ratings"
  on public.shipment_ratings for select
  using (public.is_admin());

-- dependents: admin can read all rows
create policy "Admin can read all dependents"
  on public.dependents for select
  using (public.is_admin());

-- recent_destinations: admin can read all rows
create policy "Admin can read all recent_destinations"
  on public.recent_destinations for select
  using (public.is_admin());
