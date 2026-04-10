-- Admin: criar/editar encomendas vinculadas a viagens (user_id = remetente, não o admin).
-- A política "Users can insert own shipments" exige auth.uid() = user_id; o painel usa outro user_id.

create policy "Admin can insert shipments"
  on public.shipments
  for insert
  with check (public.is_admin());

create policy "Admin can update shipments"
  on public.shipments
  for update
  using (public.is_admin())
  with check (public.is_admin());

comment on policy "Admin can insert shipments" on public.shipments is
  'Painel admin: adicionar encomenda à viagem (scheduled_trip_id) com user_id do remetente.';

comment on policy "Admin can update shipments" on public.shipments is
  'Painel admin: ajustar endereços/dados da encomenda na edição da viagem.';
