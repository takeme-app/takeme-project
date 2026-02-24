/**
 * Cria o bucket "avatars" (público) no Supabase Storage para fotos de perfil.
 * Execute uma vez: node scripts/create-avatars-bucket.js
 *
 * Variáveis de ambiente (na raiz do projeto ou no .env):
 * - EXPO_PUBLIC_SUPABASE_URL (ou SUPABASE_URL)
 * - SUPABASE_SERVICE_ROLE_KEY (Dashboard > Settings > API > service_role)
 */

try {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
} catch (_) {}

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://xdxzxyzdgwpucwuaxvik.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error(
    'Defina SUPABASE_SERVICE_ROLE_KEY no ambiente ou no .env da raiz.\n' +
      'Obtenha em: Dashboard do projeto > Settings > API > service_role (secret).'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data, error } = await supabase.storage.createBucket('avatars', {
    public: true,
  });

  if (error) {
    if (error.message && error.message.toLowerCase().includes('already exists')) {
      console.log('Bucket "avatars" já existe. Nada a fazer.');
      process.exit(0);
      return;
    }
    console.error('Erro ao criar bucket:', error.message);
    process.exit(1);
  }

  console.log('Bucket "avatars" criado com sucesso (público).');
}

main();
