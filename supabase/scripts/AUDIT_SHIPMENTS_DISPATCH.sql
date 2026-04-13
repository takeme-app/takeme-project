-- Auditoria manual (produção / staging): amostra de envios, oferta sequencial e viagens.
-- Executar no SQL Editor do Supabase (planejamento / suporte).

SELECT
  s.id,
  s.status,
  s.base_id,
  s.origin_city,
  s.client_preferred_driver_id,
  s.driver_id,
  s.scheduled_trip_id,
  s.driver_offer_index,
  s.current_offer_driver_id,
  s.current_offer_expires_at,
  s.cancellation_reason,
  s.created_at
FROM public.shipments s
ORDER BY s.created_at DESC
LIMIT 40;

-- Últimos envios com oferta ativa
SELECT
  s.id,
  s.current_offer_driver_id,
  s.current_offer_expires_at,
  s.driver_offer_queue
FROM public.shipments s
WHERE s.driver_id IS NULL
  AND s.status = 'confirmed'
  AND s.current_offer_driver_id IS NOT NULL
ORDER BY s.created_at DESC
LIMIT 20;

-- Viagens agendadas recentes (contexto de rota)
SELECT
  st.id,
  st.driver_id,
  st.status,
  st.is_active,
  st.seats_available,
  st.departure_at,
  st.origin_lat,
  st.origin_lng,
  st.destination_lat,
  st.destination_lng
FROM public.scheduled_trips st
WHERE st.departure_at > now() - interval '7 days'
ORDER BY st.departure_at DESC
LIMIT 30;
