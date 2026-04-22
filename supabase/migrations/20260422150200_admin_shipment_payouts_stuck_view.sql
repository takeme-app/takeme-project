-- View de alerta para admin: payouts de shipment/excursion em aberto ha > 3 dias.
--
-- Contexto: com transfer explicito no payout (opcao arquitetural B), enquanto
-- o admin nao rodar process-payouts, o dinheiro fica na plataforma e o
-- preparador nao recebe. Essa view fornece sinal para a tela de payouts do
-- admin mostrar alerta visual e (opcionalmente) cron para notification.
--
-- Usa security_invoker=true — RLS das base tables (payouts, worker_profiles)
-- cuida do acesso. Admin ja passa pelas policies is_admin existentes.

create or replace view public.admin_shipment_payouts_stuck
with (security_invoker = true) as
select
  p.id as payout_id,
  p.worker_id,
  wp.subtype,
  p.entity_type,
  p.entity_id,
  p.worker_amount_cents,
  p.status,
  p.created_at,
  (now() - p.created_at) as age
from public.payouts p
join public.worker_profiles wp on wp.id = p.worker_id
where p.status in ('pending', 'processing')
  and p.entity_type in ('shipment', 'dependent_shipment', 'excursion')
  and (now() - p.created_at) > interval '3 days';

comment on view public.admin_shipment_payouts_stuck is
  'Payouts de shipment/dependent_shipment/excursion com mais de 3 dias pendentes/processing. Consumida pela tela admin de payouts para alertar sobre dinheiro retido.';
