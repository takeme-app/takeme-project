-- Cadastro motorista SEM Edge Function:
-- 1) Cliente: supabase.auth.signUp({ email, password, options: { data: { full_name, phone } } })
--    → trigger handle_new_user cria linha em public.profiles
-- 2) Cliente (já autenticado): UPDATE profiles (cpf, city, ...) — policy já existe
-- 3) Cliente: INSERT worker_profiles com id = auth.uid() — esta policy
-- 4) Cliente: INSERT vehicles / worker_routes — policies vehicles_insert_own / worker_routes_insert_own já existem
--
-- subtype no banco: use 'takeme' | 'partner' (CHECK de produção), não take_me/parceiro.
-- Validação de negócio (rotas, CPF, veículo) fica no app ou numa RPC futura — não na edge.

drop policy if exists "worker_profiles_insert_own" on public.worker_profiles;

create policy "worker_profiles_insert_own"
  on public.worker_profiles for insert
  to authenticated
  with check (id = auth.uid());
