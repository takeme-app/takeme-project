-- Admin: editar excursão/preparador no painel (RLS).
-- Requer is_admin() (app_metadata.role = 'admin') já definido em 20250312000000_admin_readonly_policies.sql

-- worker_profiles: leitura para detalhe do preparador
DROP POLICY IF EXISTS "Admin can read all worker_profiles" ON public.worker_profiles;
CREATE POLICY "Admin can read all worker_profiles"
  ON public.worker_profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- worker_profiles: atualização de dados cadastrais pelo admin
DROP POLICY IF EXISTS "Admin can update all worker_profiles" ON public.worker_profiles;
CREATE POLICY "Admin can update all worker_profiles"
  ON public.worker_profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- excursion_requests: atualização (horários, preparador, notas, etc.)
DROP POLICY IF EXISTS "Admin can update all excursion_requests" ON public.excursion_requests;
CREATE POLICY "Admin can update all excursion_requests"
  ON public.excursion_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- profiles: atualização limitada ao painel admin (nome/cpf exibidos no preparador)
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
CREATE POLICY "Admin can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- vehicles: veículo ligado ao preparador
DROP POLICY IF EXISTS "Admin can read all vehicles" ON public.vehicles;
CREATE POLICY "Admin can read all vehicles"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin can update all vehicles" ON public.vehicles;
CREATE POLICY "Admin can update all vehicles"
  ON public.vehicles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- status_history: sem alterar RLS aqui — triggers de log precisam continuar a inserir sem bloqueio.
