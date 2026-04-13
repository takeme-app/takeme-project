-- Função para aplicar horário automático de disponibilidade (09h-18h BRT).
-- Marca admins como 'online' dentro do horário e 'offline' fora.
-- Respeita quem manualmente escolheu 'away' (não sobrescreve).

CREATE OR REPLACE FUNCTION public.apply_admin_auto_availability()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_hour int;
  v_in_hours boolean;
BEGIN
  -- Horário de Brasília (UTC-3)
  v_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE 'America/Sao_Paulo'));
  v_in_hours := v_hour >= 9 AND v_hour < 18;

  IF v_in_hours THEN
    -- Dentro do horário: marcar offline → online
    UPDATE public.worker_profiles
    SET availability = 'online', updated_at = now()
    WHERE role = 'admin'
      AND availability = 'offline';
  ELSE
    -- Fora do horário: marcar online → offline
    UPDATE public.worker_profiles
    SET availability = 'offline', updated_at = now()
    WHERE role = 'admin'
      AND availability = 'online';
  END IF;
  -- 'away' nunca é alterado automaticamente (escolha manual do usuário)
END;
$$;

-- Habilitar extensão pg_cron se necessário (Supabase já tem habilitado)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar execução a cada hora cheia
-- SELECT cron.schedule('admin-auto-availability', '0 * * * *', 'SELECT public.apply_admin_auto_availability()');
-- NOTA: O cron.schedule precisa ser executado manualmente no Supabase Dashboard > SQL Editor
-- pois migrations não têm acesso ao schema cron por padrão.
