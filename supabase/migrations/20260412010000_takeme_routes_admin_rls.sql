-- Rotas Take Me: o bootstrap só criou SELECT para authenticated; INSERT/UPDATE/DELETE ficaram bloqueados pelo RLS.
-- Alinha com worker_routes (admin) e com o comentário original da tabela.

drop policy if exists "Admin can insert takeme_routes" on public.takeme_routes;
create policy "Admin can insert takeme_routes"
  on public.takeme_routes for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admin can update takeme_routes" on public.takeme_routes;
create policy "Admin can update takeme_routes"
  on public.takeme_routes for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin can delete takeme_routes" on public.takeme_routes;
create policy "Admin can delete takeme_routes"
  on public.takeme_routes for delete
  to authenticated
  using (public.is_admin());

comment on policy "Admin can insert takeme_routes" on public.takeme_routes is
  'Painel admin (is_admin): criar rotas padrão Take Me.';
comment on policy "Admin can update takeme_routes" on public.takeme_routes is
  'Painel admin: editar rotas padrão.';
comment on policy "Admin can delete takeme_routes" on public.takeme_routes is
  'Painel admin: remover rotas padrão.';
