-- Permite criar o draft de worker_profiles logo após o PIN (verify-(email|phone)-code)
-- com apenas (id, role, subtype, status='inactive'). As colunas abaixo são preenchidas
-- só na etapa 4 (Complete seu perfil); relaxar NOT NULL aqui é necessário porque o
-- banco de dev herdou constraints NOT NULL da tabela legada `motorista_profiles`
-- (as migrations originais de worker_profiles já criam essas colunas nullable).
--
-- Idempotente: se a coluna já for nullable, o ALTER é no-op; se a coluna não existir
-- neste ambiente, a exceção `undefined_column` é engolida.
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.worker_profiles ALTER COLUMN cpf DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.worker_profiles ALTER COLUMN age DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.worker_profiles ALTER COLUMN city DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.worker_profiles ALTER COLUMN experience_years DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.worker_profiles ALTER COLUMN preference_area DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.worker_profiles ALTER COLUMN cnh_document_url DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.worker_profiles ALTER COLUMN cnh_document_back_url DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.worker_profiles ALTER COLUMN background_check_url DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.worker_profiles ALTER COLUMN base_id DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;
END $$;
