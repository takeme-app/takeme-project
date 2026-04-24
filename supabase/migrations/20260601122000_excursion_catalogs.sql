-- 20260601122000_excursion_catalogs.sql
-- Cria dois catálogos reutilizáveis pelo backoffice ao elaborar
-- orçamentos de excursão (ElaborarOrcamentoScreen):
--   1) excursion_package_catalog  — pacotes (hospedagem, transporte, etc.)
--   2) excursion_recreation_items — itens de recreação (passeios, atividades)
-- Ambos são referenciados como linhas livres dentro de excursion_requests.budget_lines.

BEGIN;

-- Catálogo de pacotes de excursão ------------------------------------------
CREATE TABLE IF NOT EXISTS public.excursion_package_catalog (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  description         text        NULL,
  default_value_cents integer     NOT NULL DEFAULT 0 CHECK (default_value_cents >= 0),
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT excursion_package_catalog_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_excursion_package_catalog_active
  ON public.excursion_package_catalog (is_active);

COMMENT ON TABLE public.excursion_package_catalog IS
  'Catálogo reutilizável de pacotes de excursão (hospedagem, transporte, alimentação, etc.) usado como import no ElaborarOrcamentoScreen.';

-- Catálogo de itens de recreação -------------------------------------------
CREATE TABLE IF NOT EXISTS public.excursion_recreation_items (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  description         text        NULL,
  default_value_cents integer     NOT NULL DEFAULT 0 CHECK (default_value_cents >= 0),
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT excursion_recreation_items_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_excursion_recreation_items_active
  ON public.excursion_recreation_items (is_active);

COMMENT ON TABLE public.excursion_recreation_items IS
  'Catálogo reutilizável de itens de recreação (passeios, atividades, tickets) usado como import no ElaborarOrcamentoScreen.';

-- RLS ----------------------------------------------------------------------
ALTER TABLE public.excursion_package_catalog   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excursion_recreation_items  ENABLE ROW LEVEL SECURITY;

-- Admins + service_role podem gerenciar; leitura para autenticados (preparadores
-- de excursão também consultam via app).
DROP POLICY IF EXISTS excursion_package_catalog_admin_all   ON public.excursion_package_catalog;
DROP POLICY IF EXISTS excursion_package_catalog_read_auth   ON public.excursion_package_catalog;
DROP POLICY IF EXISTS excursion_recreation_items_admin_all  ON public.excursion_recreation_items;
DROP POLICY IF EXISTS excursion_recreation_items_read_auth  ON public.excursion_recreation_items;

CREATE POLICY excursion_package_catalog_read_auth
  ON public.excursion_package_catalog
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY excursion_package_catalog_admin_all
  ON public.excursion_package_catalog
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.worker_profiles wp WHERE wp.id = auth.uid() AND wp.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.worker_profiles wp WHERE wp.id = auth.uid() AND wp.role = 'admin')
  );

CREATE POLICY excursion_recreation_items_read_auth
  ON public.excursion_recreation_items
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY excursion_recreation_items_admin_all
  ON public.excursion_recreation_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.worker_profiles wp WHERE wp.id = auth.uid() AND wp.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.worker_profiles wp WHERE wp.id = auth.uid() AND wp.role = 'admin')
  );

COMMIT;
