-- Token de registro adiado: validação de e-mail sem criar conta.
-- Usado no fluxo motorista: valida código → retorna token → conta criada ao enviar "Complete seu cadastro".

create table if not exists public.pending_registrations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  phone text,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now()
);

create index if not exists idx_pending_registrations_expires on public.pending_registrations(expires_at);
comment on table public.pending_registrations is 'Registros de e-mail já validado por código; conta é criada ao enviar formulário completo (create-motorista-account).';
