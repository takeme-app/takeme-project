-- Notificações ao inserir dependente (cadastro enviado) e ao aprovar (status validated).
-- Funções com SECURITY DEFINER para poder inserir em public.notifications (RLS não permite insert pelo cliente).

create or replace function public.notify_dependent_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, message, category)
  values (
    new.user_id,
    'Cadastro enviado',
    'O cadastro do dependente foi enviado para análise.',
    'dependent'
  );
  return new;
end;
$$;

create or replace function public.notify_dependent_validated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'validated' and (old.status is null or old.status <> 'validated') then
    insert into public.notifications (user_id, title, message, category)
    values (
      new.user_id,
      'Dependente aprovado',
      coalesce(new.full_name, 'Dependente') || ' foi aprovado.',
      'dependent'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_dependent_inserted_notify on public.dependents;
create trigger on_dependent_inserted_notify
  after insert on public.dependents
  for each row execute function public.notify_dependent_inserted();

drop trigger if exists on_dependent_validated_notify on public.dependents;
create trigger on_dependent_validated_notify
  after update on public.dependents
  for each row execute function public.notify_dependent_validated();
