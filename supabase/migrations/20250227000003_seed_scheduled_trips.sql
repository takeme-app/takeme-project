-- Seed: viagens de exemplo para testes (usa primeiro perfil como motorista, se existir).
insert into public.scheduled_trips (
  driver_id,
  title,
  origin_address,
  origin_lat,
  origin_lng,
  destination_address,
  destination_lat,
  destination_lng,
  departure_at,
  arrival_at,
  seats_available,
  bags_available,
  badge,
  amount_cents,
  status
)
select
  p.id,
  'Itabaiana → João Pessoa',
  'Rua Padre Calado, Centro, Itabaiana, PB',
  -7.3289,
  -35.3328,
  'Centro, João Pessoa, PB',
  -7.1195,
  -34.8450,
  date_trunc('day', now()) + time '14:00',
  date_trunc('day', now()) + time '16:30',
  3,
  2,
  'Take Me',
  6400,
  'active'
from public.profiles p
limit 1;

insert into public.scheduled_trips (
  driver_id,
  title,
  origin_address,
  origin_lat,
  origin_lng,
  destination_address,
  destination_lat,
  destination_lng,
  departure_at,
  arrival_at,
  seats_available,
  bags_available,
  badge,
  amount_cents,
  status
)
select
  p.id,
  'Itabaiana → João Pessoa',
  'Terminal Rodoviário de Itabaiana, Itabaiana, PB',
  -7.3340,
  -35.3390,
  'Av. Epitácio Pessoa, João Pessoa, PB',
  -7.1195,
  -34.8450,
  date_trunc('day', now()) + time '14:05',
  date_trunc('day', now()) + time '16:35',
  2,
  1,
  'Parceiro',
  5500,
  'active'
from public.profiles p
limit 1;
