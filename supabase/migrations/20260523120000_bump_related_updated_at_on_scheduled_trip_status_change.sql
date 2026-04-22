-- Quando scheduled_trips.status muda (ex.: active ao iniciar viagem,
-- completed ao concluir) os cards de "Atividades" do cliente dependem desse
-- status para calcular o badge (Em andamento, Concluída, etc.). Sem propagação,
-- bookings/shipments/dependent_shipments não recebem UPDATE e o Realtime
-- (postgres_changes) inscrito no app cliente nunca dispara, exigindo refresh
-- manual.
--
-- Solução: trigger AFTER UPDATE OF status em scheduled_trips que "bump" apenas
-- o campo updated_at das linhas filhas ainda não canceladas. Isso faz o
-- Realtime emitir evento (a tela ActivitiesScreen já escuta UPDATE em todas as
-- três tabelas) e o badge é recalculado pelo client a partir do JOIN com
-- scheduled_trips.
--
-- Casos já cobertos por outros triggers/fluxos:
--   - status='cancelled' já é propagado por sync_bookings_when_scheduled_trip_cancelled
--     (altera bookings.status; esse trigger já dispara Realtime). O bump aqui
--     é idempotente e não conflita.
--
-- SECURITY DEFINER: o motorista é dono da scheduled_trip mas não tem UPDATE
-- direto em bookings/shipments/dependent_shipments (cada uma é do passageiro).
-- O trigger corre como owner para contornar RLS, sem alterar status.

CREATE OR REPLACE FUNCTION public.bump_related_updated_at_on_scheduled_trip_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  UPDATE public.bookings
  SET updated_at = now()
  WHERE scheduled_trip_id = NEW.id
    AND status <> 'cancelled';

  UPDATE public.shipments
  SET updated_at = now()
  WHERE scheduled_trip_id = NEW.id
    AND status <> 'cancelled';

  UPDATE public.dependent_shipments
  SET updated_at = now()
  WHERE scheduled_trip_id = NEW.id
    AND status <> 'cancelled';

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.bump_related_updated_at_on_scheduled_trip_status_change() IS
  'Toca updated_at em bookings/shipments/dependent_shipments vinculados quando scheduled_trips.status muda, para acionar Realtime no app cliente.';

DROP TRIGGER IF EXISTS trg_bump_related_updated_at_on_scheduled_trip_status_change ON public.scheduled_trips;

CREATE TRIGGER trg_bump_related_updated_at_on_scheduled_trip_status_change
  AFTER UPDATE OF status ON public.scheduled_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_related_updated_at_on_scheduled_trip_status_change();
