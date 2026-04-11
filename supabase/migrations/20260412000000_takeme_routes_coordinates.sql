-- Coordenadas das rotas padrão Take Me (origem/destino do Places / geocode).
alter table public.takeme_routes
  add column if not exists origin_lat double precision,
  add column if not exists origin_lng double precision,
  add column if not exists destination_lat double precision,
  add column if not exists destination_lng double precision;

comment on column public.takeme_routes.origin_lat is 'Latitude da origem (Google Places / geocode).';
comment on column public.takeme_routes.origin_lng is 'Longitude da origem.';
comment on column public.takeme_routes.destination_lat is 'Latitude do destino.';
comment on column public.takeme_routes.destination_lng is 'Longitude do destino.';
