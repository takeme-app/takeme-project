-- Atualiza as 2 viagens de teste: origem no centro de Itabaiana, PB e destino João Pessoa, PB.
-- Assim buscas como Itabaiana → Recife não retornam essas viagens (quando houver filtro por rota).

update public.scheduled_trips
set
  title             = 'Itabaiana → João Pessoa',
  origin_address    = 'Rua Padre Calado, Centro, Itabaiana, PB',
  origin_lat        = -7.3289,
  origin_lng        = -35.3328,
  destination_address = 'Centro, João Pessoa, PB',
  destination_lat   = -7.1195,
  destination_lng   = -34.8450,
  updated_at        = now()
where id in (
  select id from public.scheduled_trips
  order by created_at
  limit 2
);
