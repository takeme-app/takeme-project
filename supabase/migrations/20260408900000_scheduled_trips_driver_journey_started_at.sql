-- Separa "oferta ativa para o passageiro" (status + is_active) de "viagem em execução na Home" (motorista tocou Iniciar viagem).
alter table public.scheduled_trips
  add column if not exists driver_journey_started_at timestamptz null;

comment on column public.scheduled_trips.driver_journey_started_at is
  'Preenchido quando o motorista inicia a viagem no app. Até lá a oferta pode aparecer ao cliente (is_active) sem ocupar a Home.';
