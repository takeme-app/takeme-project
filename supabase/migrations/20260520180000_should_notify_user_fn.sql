-- Função utilitária usada pelos triggers de notificação do motorista (e futuramente
-- do cliente) para respeitar as preferências em public.notification_preferences.
--
-- Regras:
--  1) Categorias críticas (cadastro aprovado/reprovado, conta criada) SEMPRE passam
--     — são comunicações operacionais que o usuário não pode silenciar.
--  2) Se o usuário marcou `disable_all = true`, bloqueia tudo (exceto críticas).
--  3) Caso contrário, resolve a preferência correspondente ao grupo da categoria:
--        travel_updates                     -> travel_updates
--        trip_started|trip_completed|
--        trip_closed|trip_upcoming_1h|
--        activity_status_changed|
--        booking_cancelled_by_passenger     -> travel_updates
--        shipments_deliveries|shipment|
--        dependent_shipment                 -> shipments_deliveries
--        excursions_dependents|excursion    -> excursions_dependents
--        payment_received                   -> payments_received
--        payments_pending|payment           -> payments_pending
--        payment_receipts                   -> payment_receipts
--        offers_promotions                  -> offers_promotions
--        app_updates                        -> app_updates
--        first_steps_hints                  -> first_steps_hints
--     Se a linha em notification_preferences não existir para a chave, default = TRUE
--     (mantém comportamento atual de "tudo ligado por padrão").

CREATE OR REPLACE FUNCTION public.should_notify_user(
  p_user_id uuid,
  p_category text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pref_key text;
  disabled_all boolean;
  pref_enabled boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Categorias críticas nunca são silenciadas.
  IF p_category IN ('account_approved', 'account_rejected', 'account') THEN
    RETURN true;
  END IF;

  pref_key := CASE
    WHEN p_category IN (
      'travel_updates', 'trip_started', 'trip_completed', 'trip_closed',
      'trip_upcoming_1h', 'activity_status_changed', 'booking_cancelled_by_passenger',
      'booking'
    ) THEN 'travel_updates'
    WHEN p_category IN ('shipments_deliveries', 'shipment', 'dependent_shipment') THEN 'shipments_deliveries'
    WHEN p_category IN ('excursions_dependents', 'excursion', 'dependent') THEN 'excursions_dependents'
    WHEN p_category IN ('payment_received') THEN 'payments_received'
    WHEN p_category IN ('payments_pending', 'payment') THEN 'payments_pending'
    WHEN p_category = 'payment_receipts' THEN 'payment_receipts'
    WHEN p_category = 'offers_promotions' THEN 'offers_promotions'
    WHEN p_category = 'app_updates' THEN 'app_updates'
    WHEN p_category = 'first_steps_hints' THEN 'first_steps_hints'
    ELSE NULL
  END;

  -- disable_all zera tudo (exceto críticas já tratadas acima).
  SELECT enabled INTO disabled_all
  FROM public.notification_preferences
  WHERE user_id = p_user_id AND key = 'disable_all';

  IF COALESCE(disabled_all, false) THEN
    RETURN false;
  END IF;

  IF pref_key IS NULL THEN
    -- Categoria desconhecida: deixa passar (não perde notificações novas antes de mapear).
    RETURN true;
  END IF;

  SELECT enabled INTO pref_enabled
  FROM public.notification_preferences
  WHERE user_id = p_user_id AND key = pref_key;

  -- Sem linha explícita -> padrão ligado.
  RETURN COALESCE(pref_enabled, true);
END;
$$;

COMMENT ON FUNCTION public.should_notify_user(uuid, text) IS
  'Consulta notification_preferences para decidir se um user_id deve receber uma notificação da category informada. Retorna TRUE por padrão (preferência ausente); respeita disable_all; categorias account_* são sempre entregues.';

GRANT EXECUTE ON FUNCTION public.should_notify_user(uuid, text) TO authenticated, service_role;
