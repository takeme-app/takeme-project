-- Política UPDATE em shipments (cancelar envio, atualizar gorjeta, etc.)
create policy "Users can update own shipments"
  on public.shipments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Gorjeta em centavos (null = nenhuma enviada)
alter table public.shipments
  add column if not exists tip_cents integer check (tip_cents is null or tip_cents >= 0);

comment on column public.shipments.tip_cents is 'Gorjeta enviada ao motorista, em centavos; null se nenhuma.';
