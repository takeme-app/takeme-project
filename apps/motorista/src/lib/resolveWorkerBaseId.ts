import { normalizeLocationKey } from '@take-me/shared';
import { supabase } from './supabase';

/**
 * Se existir base ativa cuja cidade bate com a localidade escolhida (Google) ou texto digitado,
 * retorna o id para gravar em worker_profiles.base_id.
 */
export async function resolveWorkerBaseId(
  locality: string | null,
  adminAreaLevel1: string | null,
  displayCityFallback: string,
): Promise<string | null> {
  const rawCity = locality?.trim() || displayCityFallback.trim();
  if (!rawCity) return null;
  const key = normalizeLocationKey(rawCity);
  const stateKey = adminAreaLevel1?.trim() ? normalizeLocationKey(adminAreaLevel1) : null;

  const { data, error } = await supabase.from('bases').select('id, city, state').eq('is_active', true);
  if (error || !data?.length) return null;

  const exact = data.filter((b) => normalizeLocationKey(b.city || '') === key);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1 && stateKey) {
    const byState = exact.find((b) => {
      if (!b.state?.trim()) return false;
      const bs = normalizeLocationKey(b.state);
      return bs === stateKey || stateKey.includes(bs) || bs.includes(stateKey);
    });
    if (byState) return byState.id;
    return exact[0].id;
  }
  if (exact.length > 1) return exact[0].id;

  const loose = data.filter((b) => {
    const bc = normalizeLocationKey(b.city || '');
    return bc.includes(key) || key.includes(bc);
  });
  if (loose.length === 1) return loose[0].id;
  if (loose.length > 1 && stateKey) {
    const byState = loose.find((b) => {
      if (!b.state?.trim()) return false;
      const bs = normalizeLocationKey(b.state);
      return bs === stateKey || stateKey.includes(bs) || bs.includes(stateKey);
    });
    if (byState) return byState.id;
  }
  return loose[0]?.id ?? null;
}
