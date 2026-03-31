-- Backfill: viagens agendadas (scheduled_trips) com origem/destino em 0,0 recebem
-- as coordenadas da rota do motorista (worker_routes) quando route_id bate e a rota tem geo.
--
-- Onde aplicar:
--   • Produção/staging: Supabase Dashboard → SQL → colar e rodar, OU
--   • A partir do repo: na raiz do projeto, `supabase db push` (aplica migrações pendentes).
--
-- Linhas sem route_id ou cuja worker_routes ainda não tem lat/lng não são alteradas
-- (geocode manual ou atualizar worker_routes antes).

update public.scheduled_trips st
set
  origin_lat = wr.origin_lat,
  origin_lng = wr.origin_lng,
  destination_lat = wr.destination_lat,
  destination_lng = wr.destination_lng,
  updated_at = now()
from public.worker_routes wr
where st.route_id = wr.id
  and wr.origin_lat is not null
  and wr.origin_lng is not null
  and wr.destination_lat is not null
  and wr.destination_lng is not null
  and (
    (st.origin_lat = 0 and st.origin_lng = 0)
    or (st.destination_lat = 0 and st.destination_lng = 0)
  );
