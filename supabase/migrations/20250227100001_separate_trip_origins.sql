-- Separa as origens das 2 viagens de teste: uma na Rua Padre Calado, outra na Praça Getúlio Vargas (coordenadas próximas mas distintas no mapa).
update public.scheduled_trips
set
  origin_address = 'Praça Getúlio Vargas, Centro, Itabaiana, PB',
  origin_lat     = -7.3292,
  origin_lng     = -35.3330,
  updated_at     = now()
where id = (
  select id from public.scheduled_trips
  order by created_at
  offset 1
  limit 1
);
