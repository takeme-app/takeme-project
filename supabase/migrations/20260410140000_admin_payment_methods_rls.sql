-- Admin (is_admin()): ler e inserir payment_methods em nome de passageiros.
-- O app admin só persiste last_four + metadados; PAN completo e CVV não vão ao banco.

drop policy if exists "Admin can read all payment_methods" on public.payment_methods;
drop policy if exists "Admin can insert payment_methods" on public.payment_methods;

create policy "Admin can read all payment_methods"
  on public.payment_methods
  for select
  using (public.is_admin());

create policy "Admin can insert payment_methods"
  on public.payment_methods
  for insert
  with check (public.is_admin());
