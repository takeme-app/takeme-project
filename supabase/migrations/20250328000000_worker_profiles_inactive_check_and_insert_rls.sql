-- Corrige cadastro motorista no app quando:
-- A) CHECK worker_profiles_status_check ainda não inclui 'inactive' → erro parecido com
--    "new row for relation worker_profiles violates check constraint worker_profiles_status_check"
--    (isso NÃO é RLS; é constraint de status.)
-- B) Falta policy de INSERT para authenticated → aí sim seria "violates row-level security policy".

-- 1) Status: permitir inactive + default
alter table public.worker_profiles drop constraint if exists worker_profiles_status_check;

alter table public.worker_profiles
  add constraint worker_profiles_status_check
  check (
    status = any (
      array[
        'inactive'::text,
        'pending'::text,
        'under_review'::text,
        'approved'::text,
        'rejected'::text,
        'suspended'::text
      ]
    )
  );

alter table public.worker_profiles alter column status set default 'inactive';

-- 2) RLS: insert da própria linha (id = auth.uid())
drop policy if exists "worker_profiles_insert_own" on public.worker_profiles;

create policy "worker_profiles_insert_own"
  on public.worker_profiles for insert
  to authenticated
  with check (id = auth.uid());
