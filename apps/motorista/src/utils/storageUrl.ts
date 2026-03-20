import { supabase } from '../lib/supabase';

/**
 * Resolve um valor de storage para URL pública.
 * Aceita tanto caminhos relativos ("userId/avatar.jpg") quanto URLs completas.
 */
export function storageUrl(bucket: string, pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
  const { data } = supabase.storage.from(bucket).getPublicUrl(pathOrUrl);
  return data.publicUrl;
}
