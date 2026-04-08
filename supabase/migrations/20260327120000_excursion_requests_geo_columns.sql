-- Coordenadas e texto de origem para mapas / rota nas excursões.
alter table public.excursion_requests
  add column if not exists origin text,
  add column if not exists origin_lat double precision,
  add column if not exists origin_lng double precision,
  add column if not exists destination_lat double precision,
  add column if not exists destination_lng double precision;

comment on column public.excursion_requests.origin is 'Cidade ou ponto de partida (texto exibido ao motorista).';
comment on column public.excursion_requests.origin_lat is 'Latitude da origem quando conhecida (opcional).';
comment on column public.excursion_requests.origin_lng is 'Longitude da origem quando conhecida (opcional).';
comment on column public.excursion_requests.destination_lat is 'Latitude do destino (geocode ou preset).';
comment on column public.excursion_requests.destination_lng is 'Longitude do destino (geocode ou preset).';
