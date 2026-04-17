-- Destino do FCM (app cliente vs motorista). Evita enviar push de passageiro no app motorista
-- e vice-versa (ex.: mesma category travel_updates nos dois fluxos).

alter table public.notifications
  add column if not exists target_app_slug text not null default 'cliente'
  constraint notifications_target_app_slug_check
  check (target_app_slug in ('cliente', 'motorista'));

comment on column public.notifications.target_app_slug is
  'Qual app deve receber o push (FCM). Padrão cliente; notificações ao motorista usam motorista.';

-- Motorista: nova reserva / encomenda na viagem
create or replace function public.notify_driver_new_booking_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  drv uuid;
  daddr text;
begin
  if new.status is null or new.status not in ('pending', 'paid') then
    return new;
  end if;

  select st.driver_id, st.destination_address
  into drv, daddr
  from public.scheduled_trips st
  where st.id = new.scheduled_trip_id;

  if drv is null then
    return new;
  end if;

  insert into public.notifications (user_id, title, message, category, target_app_slug)
  values (
    drv,
    'Nova solicitação de reserva',
    format(
      'Passageiro pediu vaga: %s → %s. Abra Solicitações pendentes para aceitar ou recusar.',
      left(coalesce(new.origin_address, 'origem'), 80),
      left(coalesce(new.destination_address, daddr, 'destino'), 80)
    ),
    'travel_updates',
    'motorista'
  );

  return new;
end;
$$;

create or replace function public.notify_driver_shipment_on_trip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  drv uuid;
  became_linked boolean;
begin
  if new.scheduled_trip_id is null then
    return new;
  end if;

  if new.base_id is not null then
    return new;
  end if;

  if new.status is null or new.status not in ('pending_review', 'confirmed') then
    return new;
  end if;

  if new.driver_id is not null then
    return new;
  end if;

  became_linked :=
    tg_op = 'insert'
    or (tg_op = 'update' and (old.scheduled_trip_id is distinct from new.scheduled_trip_id));

  if not became_linked then
    return new;
  end if;

  select st.driver_id into drv
  from public.scheduled_trips st
  where st.id = new.scheduled_trip_id;

  if drv is null then
    return new;
  end if;

  insert into public.notifications (user_id, title, message, category, target_app_slug)
  values (
    drv,
    'Nova encomenda na sua viagem',
    'Um cliente adicionou um envio à sua rota. Veja em Solicitações pendentes.',
    'shipments_deliveries',
    'motorista'
  );

  return new;
end;
$$;

-- Passageiros / clientes (app cliente)
create or replace function public.notify_passengers_driver_journey_started()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dest_preview text;
begin
  if tg_op <> 'update' then
    return new;
  end if;

  if new.driver_journey_started_at is null then
    return new;
  end if;

  if old.driver_journey_started_at is not null then
    return new;
  end if;

  dest_preview := left(coalesce(new.destination_address, 'destino'), 100);

  insert into public.notifications (user_id, title, message, category, target_app_slug)
  select distinct
    u.uid,
    'Motorista a caminho',
    format(
      'O motorista iniciou a viagem rumo a %s. Acompanhe no app.',
      dest_preview
    ),
    'travel_updates',
    'cliente'
  from (
    select b.user_id as uid
    from public.bookings b
    where b.scheduled_trip_id = new.id
      and b.status in ('paid', 'confirmed')
    union
    select ds.user_id
    from public.dependent_shipments ds
    where ds.scheduled_trip_id = new.id
      and ds.status in ('confirmed', 'in_progress')
    union
    select s.user_id
    from public.shipments s
    where s.scheduled_trip_id = new.id
      and s.status in ('confirmed', 'in_progress')
  ) u;

  return new;
end;
$$;
