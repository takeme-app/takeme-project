-- Documentação operacional: encomendas no app cliente priorizam trechos per_km
-- e usam distância por rota (quando o app obtém OSRM/Mapbox), com fallback.

COMMENT ON COLUMN public.pricing_routes.pricing_mode IS
  'Modo de precificação: daily_rate | per_km | fixed. '
  'Para role_type = preparer_shipments: o app cliente tenta primeiro trechos ativos em per_km '
  '(valor base = km × price_cents); fixed/daily_rate entram como reserva se não houver trecho per_km compatível.';

COMMENT ON COLUMN public.pricing_routes.price_cents IS
  'Em fixed/daily_rate: valor total do trecho em centavos. '
  'Em per_km: centavos cobrados por quilômetro (km = distância da rota de carro quando disponível no app; senão linha reta).';
