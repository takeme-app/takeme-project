-- Rollback / manutenção: admin remove veículo criado em fluxo incompleto (ex.: falha após INSERT).

drop policy if exists "Admin can delete all vehicles" on public.vehicles;
create policy "Admin can delete all vehicles"
  on public.vehicles for delete
  to authenticated
  using (public.is_admin());

comment on policy "Admin can delete all vehicles" on public.vehicles is
  'Admin (is_admin): DELETE em vehicles (rollback pós-falha em upload ou suporte).';
