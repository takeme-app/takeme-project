/**
 * Script one-off: apaga um usuário do Auth pelo e-mail.
 * Uso: SUPABASE_SERVICE_ROLE_KEY=sua_chave node scripts/delete-user-by-email.js diego.barbosa@fraktalsoftwares.com.br
 *
 * A Service Role Key está em: Dashboard do projeto > Settings > API > service_role (secret).
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xdxzxyzdgwpucwuaxvik.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];

if (!serviceRoleKey) {
  console.error('Defina SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}
if (!email) {
  console.error('Uso: SUPABASE_SERVICE_ROLE_KEY=... node scripts/delete-user-by-email.js <email>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Erro ao listar usuários:', listError.message);
    process.exit(1);
  }
  const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.log('Usuário não encontrado com o e-mail:', email);
    process.exit(0);
  }
  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('Erro ao apagar usuário:', deleteError.message);
    process.exit(1);
  }
  console.log('Usuário apagado:', email);
}

main();
