-- is_admin(): reconhecer admin em worker_profiles mesmo com status inactive/under_review
-- (antes só approved/pending — staff admin sem fluxo de motorista ficava bloqueado no RLS).
-- SET row_security = off: a checagem em worker_profiles não depende de políticas RLS no contexto da função.

create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'admin',
    false
  ) then
    return true;
  end if;

  if coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role') = 'admin',
    false
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.worker_profiles wp
    where wp.id = auth.uid()
      and wp.role = 'admin'
      and wp.status in (
        'approved',
        'pending',
        'inactive',
        'under_review'
      )
  );
end;
$$;

comment on function public.is_admin() is
  'True if JWT app/user_metadata.role=admin, or worker_profiles has role=admin and status approved/pending/inactive/under_review. row_security=off for leitura confiável de wp.';

-- Garantir políticas de rota para admin (idempotente se migration 20260409120000 já rodou).
drop policy if exists "Admin can read all worker_routes" on public.worker_routes;
create policy "Admin can read all worker_routes"
  on public.worker_routes for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admin can insert worker_routes" on public.worker_routes;
create policy "Admin can insert worker_routes"
  on public.worker_routes for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admin can update all worker_routes" on public.worker_routes;
create policy "Admin can update all worker_routes"
  on public.worker_routes for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin can delete all worker_routes" on public.worker_routes;
create policy "Admin can delete all worker_routes"
  on public.worker_routes for delete
  to authenticated
  using (public.is_admin());
