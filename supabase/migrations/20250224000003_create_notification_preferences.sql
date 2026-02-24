-- Preferências de notificação por usuário (toggles em Configurar notificações).
create table if not exists public.notification_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  enabled boolean not null default true,
  primary key (user_id, key)
);

alter table public.notification_preferences enable row level security;

create policy "Users can view own notification preferences"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own notification preferences"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notification preferences"
  on public.notification_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.notification_preferences is 'Chaves: travel_updates, shipments_deliveries, excursions_dependents, payments_pending, payment_receipts, offers_promotions, app_updates, disable_all.';
