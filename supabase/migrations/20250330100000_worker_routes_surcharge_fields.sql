-- Ajustes de preço por tipo de dia para rotas do motorista.
alter table public.worker_routes
  add column if not exists weekend_surcharge_pct  numeric(5,2) not null default 15,
  add column if not exists nocturnal_surcharge_pct numeric(5,2) not null default 15,
  add column if not exists holiday_surcharge_pct  numeric(5,2) not null default 15;
