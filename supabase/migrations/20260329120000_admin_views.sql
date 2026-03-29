-- Admin dashboard stats view
CREATE OR REPLACE VIEW public.admin_dashboard_stats AS
SELECT
  (SELECT count(*) FROM public.bookings WHERE created_at >= date_trunc('month', now())) AS bookings_month,
  (SELECT count(*) FROM public.shipments WHERE created_at >= date_trunc('month', now())) AS shipments_month,
  (SELECT count(*) FROM public.dependent_shipments WHERE created_at >= date_trunc('month', now())) AS dependent_shipments_month,
  (SELECT count(*) FROM public.excursion_requests WHERE created_at >= date_trunc('month', now())) AS excursions_month,
  (SELECT count(*) FROM public.worker_profiles WHERE role = 'driver' AND status = 'approved') AS active_drivers,
  (SELECT count(*) FROM public.worker_profiles WHERE role = 'preparer' AND status = 'approved') AS active_preparers,
  (SELECT count(*) FROM public.bases WHERE is_active = true) AS active_bases,
  (SELECT coalesce(sum(admin_amount_cents), 0) FROM public.payouts WHERE status = 'paid' AND created_at >= date_trunc('month', now())) AS revenue_month_cents,
  (SELECT coalesce(sum(gross_amount_cents), 0) FROM public.payouts WHERE status = 'paid' AND created_at >= date_trunc('month', now())) AS gross_month_cents;

-- Destinos overview (aggregated from scheduled_trips)
CREATE OR REPLACE VIEW public.admin_destinos_overview AS
SELECT
  origin_address,
  destination_address,
  count(*) AS trip_count,
  avg(amount_cents) AS avg_price_cents,
  bool_or(is_active) AS has_active,
  max(created_at) AS last_created_at
FROM public.scheduled_trips
WHERE origin_address IS NOT NULL AND destination_address IS NOT NULL
GROUP BY origin_address, destination_address
ORDER BY trip_count DESC;

-- Worker performance overview
CREATE OR REPLACE VIEW public.admin_worker_overview AS
SELECT
  wp.id AS worker_id,
  p.full_name,
  wp.role,
  wp.subtype,
  wp.status,
  wp.city,
  wp.pix_key,
  (SELECT count(*) FROM public.payouts po WHERE po.worker_id = wp.id) AS total_payouts,
  (SELECT coalesce(sum(worker_amount_cents), 0) FROM public.payouts po WHERE po.worker_id = wp.id AND po.status = 'paid') AS total_earned_cents,
  (SELECT coalesce(avg(wr.rating), 0) FROM public.booking_ratings wr
   JOIN public.bookings b ON b.id = wr.booking_id
   JOIN public.scheduled_trips st ON st.id = b.scheduled_trip_id
   WHERE st.driver_id = wp.id) AS avg_rating
FROM public.worker_profiles wp
JOIN public.profiles p ON p.id = wp.id;
