-- Repara ambientes onde worker_profiles_subtype_check foi removido por migration antiga.
-- Produção espera: takeme, partner, shipments, excursions.
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'worker_profiles'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%subtype%'
  ) then
    alter table public.worker_profiles
      add constraint worker_profiles_subtype_check
      check (
        (subtype = any (array['takeme'::text, 'partner'::text, 'shipments'::text, 'excursions'::text]))
      );
  end if;
end $$;
