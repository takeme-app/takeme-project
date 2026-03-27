-- ============================================================================
-- TAKE ME — Filtro de viagens por proximidade geográfica
-- Substitui o filtro client-side que carrega todas as trips
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Função RPC: buscar viagens ativas por proximidade
-- ============================================================================

-- O cliente envia lat/lng de origem e destino, e um raio em graus (~0.15° ≈ 15km).
-- A função filtra no banco e retorna só as viagens compatíveis.
-- Usa cálculo simples de bounding box (rápido) + haversine para distância real.

CREATE OR REPLACE FUNCTION public.search_nearby_trips(
  p_origin_lat    double precision,
  p_origin_lng    double precision,
  p_dest_lat      double precision,
  p_dest_lng      double precision,
  p_radius_deg    double precision DEFAULT 0.15,  -- ~15km
  p_limit         integer DEFAULT 50
)
RETURNS TABLE (
  id                    uuid,
  driver_id             uuid,
  route_id              uuid,
  origin_address        text,
  origin_lat            double precision,
  origin_lng            double precision,
  destination_address   text,
  destination_lat       double precision,
  destination_lng       double precision,
  departure_at          timestamptz,
  arrival_at            timestamptz,
  seats_available       smallint,
  bags_available        smallint,
  price_per_person_cents integer,
  badge                 text,
  status                text,
  trunk_occupancy_pct   smallint,
  confirmed_count       integer,
  driver_name           text,
  driver_rating         numeric,
  origin_distance_km    double precision,
  dest_distance_km      double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    t.id,
    t.driver_id,
    t.route_id,
    t.origin_address,
    t.origin_lat,
    t.origin_lng,
    t.destination_address,
    t.destination_lat,
    t.destination_lng,
    t.departure_at,
    t.arrival_at,
    t.seats_available,
    t.bags_available,
    t.price_per_person_cents,
    t.badge,
    t.status,
    t.trunk_occupancy_pct,
    t.confirmed_count,
    p.full_name AS driver_name,
    p.rating AS driver_rating,
    -- Haversine simplificado para distância em km (origem)
    (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_origin_lat)) * cos(radians(t.origin_lat))
          * cos(radians(t.origin_lng) - radians(p_origin_lng))
          + sin(radians(p_origin_lat)) * sin(radians(t.origin_lat))
        ))
      )
    ) AS origin_distance_km,
    -- Haversine simplificado para distância em km (destino)
    (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_dest_lat)) * cos(radians(t.destination_lat))
          * cos(radians(t.destination_lng) - radians(p_dest_lng))
          + sin(radians(p_dest_lat)) * sin(radians(t.destination_lat))
        ))
      )
    ) AS dest_distance_km
  FROM public.scheduled_trips t
  LEFT JOIN public.profiles p ON p.id = t.driver_id
  WHERE
    t.status = 'active'
    AND t.is_active = true
    AND t.departure_at > now()
    AND t.seats_available > 0
    -- Bounding box filter (rápido, usa índices)
    AND t.origin_lat      BETWEEN (p_origin_lat - p_radius_deg) AND (p_origin_lat + p_radius_deg)
    AND t.origin_lng      BETWEEN (p_origin_lng - p_radius_deg) AND (p_origin_lng + p_radius_deg)
    AND t.destination_lat BETWEEN (p_dest_lat - p_radius_deg)   AND (p_dest_lat + p_radius_deg)
    AND t.destination_lng BETWEEN (p_dest_lng - p_radius_deg)   AND (p_dest_lng + p_radius_deg)
  ORDER BY origin_distance_km ASC, departure_at ASC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.search_nearby_trips IS
  'Busca viagens ativas próximas da origem e destino do cliente. Raio padrão ~15km (0.15°).';


-- ============================================================================
-- 2. Índices geográficos para acelerar o filtro de bounding box
-- ============================================================================

-- Índice composto para filtro de origem
CREATE INDEX IF NOT EXISTS idx_scheduled_trips_origin_geo
  ON public.scheduled_trips (origin_lat, origin_lng)
  WHERE status = 'active' AND is_active = true;

-- Índice composto para filtro de destino
CREATE INDEX IF NOT EXISTS idx_scheduled_trips_dest_geo
  ON public.scheduled_trips (destination_lat, destination_lng)
  WHERE status = 'active' AND is_active = true;

-- Índice para departure_at futuro (viagens ativas futuras)
CREATE INDEX IF NOT EXISTS idx_scheduled_trips_future_active
  ON public.scheduled_trips (departure_at)
  WHERE status = 'active' AND is_active = true AND seats_available > 0;


-- ============================================================================
-- 3. Exemplo de uso no cliente (Supabase JS):
--
--   const { data, error } = await supabase
--     .rpc('search_nearby_trips', {
--       p_origin_lat: -3.7172,
--       p_origin_lng: -38.5433,
--       p_dest_lat: -3.1190,
--       p_dest_lng: -40.1484,
--       p_radius_deg: 0.15,
--       p_limit: 20
--     });
--
-- Retorna viagens ordenadas por proximidade com dados do motorista.
-- ============================================================================

COMMIT;
