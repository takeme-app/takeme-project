-- Coordenadas de origem e destino para pricing_routes (resolvidas via Google Places).
ALTER TABLE public.pricing_routes
  ADD COLUMN IF NOT EXISTS origin_lat double precision,
  ADD COLUMN IF NOT EXISTS origin_lng double precision,
  ADD COLUMN IF NOT EXISTS destination_lat double precision,
  ADD COLUMN IF NOT EXISTS destination_lng double precision;
