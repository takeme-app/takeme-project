-- Coloca a segunda viagem de teste com partida na Rodoviária de Itabaiana, PB (mais afastada do centro).
update public.scheduled_trips
set
  origin_address = 'Terminal Rodoviário de Itabaiana, Itabaiana, PB',
  origin_lat     = -7.3340,
  origin_lng     = -35.3390,
  updated_at     = now()
where id = (
  select id from public.scheduled_trips
  order by created_at
  offset 1
  limit 1
);
