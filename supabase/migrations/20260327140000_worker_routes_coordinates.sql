-- Coordenadas da rota do motorista (origem/destino escolhidos no autocomplete / geocode).
alter table public.worker_routes
  add column if not exists origin_lat double precision,
  add column if not exists origin_lng double precision,
  add column if not exists destination_lat double precision,
  add column if not exists destination_lng double precision;

comment on column public.worker_routes.origin_lat is 'Latitude da origem (Mapbox ou geocode).';
comment on column public.worker_routes.origin_lng is 'Longitude da origem.';
comment on column public.worker_routes.destination_lat is 'Latitude do destino.';
comment on column public.worker_routes.destination_lng is 'Longitude do destino.';
