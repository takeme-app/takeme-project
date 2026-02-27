-- Adiciona state e cep em recent_destinations para exibição completa (Rua, Número / Cidade - UF, CEP).
alter table public.recent_destinations
  add column if not exists state text,
  add column if not exists cep text;

-- Permite atualizar used_at ao reutilizar o mesmo endereço (ordem "mais recente").
create policy "Users can update own recent_destinations"
  on public.recent_destinations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on column public.recent_destinations.state is 'UF (ex: PE).';
comment on column public.recent_destinations.cep is 'CEP quando disponível.';
