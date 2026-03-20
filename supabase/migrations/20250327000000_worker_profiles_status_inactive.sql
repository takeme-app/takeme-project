-- Motoristas criados pelo app ficam inactive até o admin liberar (ex.: status approved).
-- Produção costumava ter CHECK só em pending|under_review|approved|rejected|suspended.

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

comment on column public.worker_profiles.status is
  'inactive = cadastro novo, aguardando ação do admin; approved = ativo/liberado pelo admin; demais = fluxo operacional.';
