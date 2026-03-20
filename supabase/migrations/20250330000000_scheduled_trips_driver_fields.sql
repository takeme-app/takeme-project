-- Campos para viagens recorrentes do motorista (RouteSchedule).
-- As viagens one-shot do passageiro usam departure_at (já existe).
-- As viagens semanais do motorista usam route_id + day_of_week + departure_time.

alter table public.scheduled_trips
  add column if not exists route_id uuid references public.worker_routes (id) on delete set null,
  add column if not exists day_of_week smallint,        -- 0=Dom … 6=Sáb
  add column if not exists departure_time text,         -- "HH:MM"
  add column if not exists arrival_time text,           -- "HH:MM"
  add column if not exists capacity smallint,
  add column if not exists confirmed_count integer not null default 0,
  add column if not exists price_per_person_cents integer,
  add column if not exists is_active boolean not null default true,
  add column if not exists pickup_code text,            -- código confirmação coleta (passageiro)
  add column if not exists delivery_code text;          -- código confirmação entrega

create index if not exists idx_scheduled_trips_route_id on public.scheduled_trips (route_id);
create index if not exists idx_scheduled_trips_day on public.scheduled_trips (day_of_week);
