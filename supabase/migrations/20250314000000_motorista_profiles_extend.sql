-- Campos do protótipo "Complete seu cadastro": RG, estado, ano nascimento, placa, cor, foto perfil, origem, destino, valor sugerido.

alter table public.motorista_profiles
  add column if not exists rg text,
  add column if not exists state text,
  add column if not exists birth_year int,
  add column if not exists license_plate text,
  add column if not exists vehicle_color text,
  add column if not exists profile_photo_url text,
  add column if not exists origin text,
  add column if not exists destination text,
  add column if not exists suggested_value_per_trip numeric(10,2);

comment on column public.motorista_profiles.rg is 'RG do motorista.';
comment on column public.motorista_profiles.state is 'Estado (UF).';
comment on column public.motorista_profiles.birth_year is 'Ano de nascimento (ex: 1990).';
comment on column public.motorista_profiles.license_plate is 'Placa do veículo.';
comment on column public.motorista_profiles.vehicle_color is 'Cor do veículo.';
comment on column public.motorista_profiles.profile_photo_url is 'Path da foto de perfil no storage.';
comment on column public.motorista_profiles.origin is 'Origem (motivo da viagem).';
comment on column public.motorista_profiles.destination is 'Destino (motivo da viagem).';
comment on column public.motorista_profiles.suggested_value_per_trip is 'Valor sugerido por viagem (R$).';
