import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const STORAGE_KEY = '@takeme/recent_destinations';
const MERGE_KEY = `${STORAGE_KEY}_merged`;
const MAX_ITEMS = 10;

/** Remove o histórico de endereços do dispositivo (ex.: após exclusão de conta). */
export async function clearRecentDestinationsStorage(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([STORAGE_KEY, MERGE_KEY]);
  } catch {
    // ignore
  }
}

export type RecentDestination = {
  address: string;
  city: string;
  state?: string;
  cep?: string;
  latitude?: number;
  longitude?: number;
};

/** Formata para exibição no histórico: linha 1 = Rua, Número; linha 2 = Cidade - UF, CEP */
export function formatRecentDestinationDisplay(item: RecentDestination): { line1: string; line2: string } {
  const line1 = (item.address ?? '').trim();
  const city = (item.city ?? '').trim();
  if (item.state && city) {
    const cityUf = `${city} - ${item.state}`;
    const line2 = item.cep ? `${cityUf}, ${item.cep}` : cityUf;
    return { line1, line2 };
  }
  return { line1, line2: city };
}

/** Chave normalizada para comparar endereços (evita duplicatas como "Recife, PE" vs "Recife-PE"). */
function normalizeKey(address: string, city: string): string {
  const combined = `${(address ?? '').trim()}, ${(city ?? '').trim()}`.toLowerCase();
  return combined.replace(/[\s,.-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Remove itens duplicados pela chave normalizada (mantém a primeira = mais recente). */
function deduplicateByAddress(list: RecentDestination[]): RecentDestination[] {
  const seen = new Set<string>();
  return list.filter((x) => {
    const key = normalizeKey(x.address, x.city);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Lê do Supabase (usuário logado) ou AsyncStorage (fallback). Sem duplicatas. */
export async function getRecentDestinations(): Promise<RecentDestination[]> {
  const readAsync = async (): Promise<RecentDestination[]> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as RecentDestination[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    mergeAsyncStorageToSupabaseOnce(user.id).catch(() => {});
    const { data } = await supabase
      .from('recent_destinations')
      .select('address, city, state, cep, latitude, longitude')
      .eq('user_id', user.id)
      .order('used_at', { ascending: false })
      .limit(MAX_ITEMS * 2);
    if (data?.length) {
      const deduped = deduplicateByAddress(data as RecentDestination[]).slice(0, MAX_ITEMS);
      return deduped;
    }
    // Usuário logado e sem histórico no Supabase (ex.: conta nova ou re-cadastro): não usar AsyncStorage do dispositivo (evita mostrar dados de outra conta).
    await AsyncStorage.multiRemove([STORAGE_KEY, MERGE_KEY]);
    return [];
  }

  const result = await readAsync();
  const deduped = deduplicateByAddress(result).slice(0, MAX_ITEMS);
  if (deduped.length === 0 && typeof setTimeout !== 'undefined') {
    await new Promise((r) => setTimeout(r, 150));
    return deduplicateByAddress(await readAsync()).slice(0, MAX_ITEMS);
  }
  return deduped;
}

/** Adiciona um destino: grava no Supabase (se logado) e mantém AsyncStorage quando não logado. Atualiza used_at se o endereço já existir. */
export async function addRecentDestination(item: RecentDestination): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const list = await getRecentDestinations();
  const newKey = normalizeKey(item.address, item.city);
  const filtered = list.filter((x) => normalizeKey(x.address, x.city) !== newKey);
  const normalizedItem = { ...item, address: item.address.trim(), city: (item.city ?? '').trim() || item.address.trim() };
  const next = [normalizedItem, ...filtered].slice(0, MAX_ITEMS);
  if (!user) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return;
  }

  const { data: existingRows } = await supabase
    .from('recent_destinations')
    .select('id, address, city')
    .eq('user_id', user.id);
  const existing = (existingRows ?? []).find((r) => normalizeKey(r.address, r.city) === newKey);
  if (existing) {
    await supabase.from('recent_destinations').update({ used_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await supabase.from('recent_destinations').insert({
      user_id: user.id,
      address: normalizedItem.address,
      city: normalizedItem.city,
      state: normalizedItem.state ?? null,
      cep: normalizedItem.cep ?? null,
      latitude: normalizedItem.latitude ?? null,
      longitude: normalizedItem.longitude ?? null,
    });
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/** Merge único: envia itens do AsyncStorage para o Supabase quando o usuário está logado (ex.: após login em novo dispositivo). */
async function mergeAsyncStorageToSupabaseOnce(userId: string): Promise<void> {
  try {
    const alreadyMerged = await AsyncStorage.getItem(MERGE_KEY);
    if (alreadyMerged === '1') return;
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      await AsyncStorage.setItem(MERGE_KEY, '1');
      return;
    }
    const parsed = JSON.parse(raw) as RecentDestination[];
    const items = Array.isArray(parsed) ? parsed : [];
    for (const it of items.slice(0, MAX_ITEMS)) {
      const row = { address: (it.address ?? '').trim(), city: (it.city ?? '').trim() || (it.address ?? '').trim(), state: it.state ?? null, cep: it.cep ?? null, latitude: it.latitude ?? null, longitude: it.longitude ?? null };
      const { data: existing } = await supabase.from('recent_destinations').select('id').eq('user_id', userId).eq('address', row.address).eq('city', row.city).maybeSingle();
      if (!existing) {
        await supabase.from('recent_destinations').insert({ user_id: userId, ...row });
      }
    }
    await AsyncStorage.setItem(MERGE_KEY, '1');
  } catch {
    // ignore
  }
}
