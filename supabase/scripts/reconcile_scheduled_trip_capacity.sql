-- Reconciliação manual (executar após deploy dos triggers, se havia dados legados).
-- 1) Alinha reservas órfãs com viagem já cancelada.
-- 2) Recalcula confirmed_count e seats_available para scheduled_trips ativos.

BEGIN;

UPDATE public.bookings b
SET status = 'cancelled', updated_at = now()
FROM public.scheduled_trips st
WHERE b.scheduled_trip_id = st.id
  AND st.status = 'cancelled'
  AND b.status = ANY (ARRAY['pending', 'paid', 'confirmed']::text[]);

WITH occ AS (
  SELECT
    scheduled_trip_id,
    SUM(CASE WHEN status IN ('pending', 'paid', 'confirmed') THEN passenger_count ELSE 0 END)::int AS taken,
    SUM(CASE WHEN status = 'confirmed' THEN passenger_count ELSE 0 END)::int AS conf
  FROM public.bookings
  GROUP BY scheduled_trip_id
)
UPDATE public.scheduled_trips st
SET
  confirmed_count = COALESCE(occ.conf, 0),
  seats_available = CASE
    WHEN st.capacity IS NOT NULL THEN GREATEST(0, st.capacity - COALESCE(occ.taken, 0))
    ELSE GREATEST(0, st.seats_available)
  END,
  updated_at = now()
FROM occ
WHERE st.id = occ.scheduled_trip_id
  AND st.status = 'active';

UPDATE public.scheduled_trips st
SET
  confirmed_count = 0,
  seats_available = COALESCE(st.capacity, st.seats_available),
  updated_at = now()
WHERE st.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.scheduled_trip_id = st.id
      AND b.status = ANY (ARRAY['pending', 'paid', 'confirmed']::text[])
  );

COMMIT;
