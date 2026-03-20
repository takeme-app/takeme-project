-- Campos alinhados ao formulário "Complete seu cadastro" (protótipo motorista).

alter table public.motorista_profiles
  add column if not exists preference_area text,
  add column if not exists owns_vehicle boolean,
  add column if not exists passenger_capacity smallint,
  add column if not exists vehicle_contact_phone text;

comment on column public.motorista_profiles.preference_area is 'Área/bairro de preferência para atuação.';
comment on column public.motorista_profiles.owns_vehicle is 'Se o motorista possui veículo próprio.';
comment on column public.motorista_profiles.passenger_capacity is 'Capacidade de passageiros do veículo (máx. 5 no app).';
comment on column public.motorista_profiles.vehicle_contact_phone is 'Telefone de contato informado na seção veículo.';
