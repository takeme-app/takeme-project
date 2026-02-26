import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const STORAGE_KEY = '@takeme/recent_destinations';
const MAX_ITEMS = 10;

export type RecentDestination = {
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
};

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
    const { data } = await supabase
      .from('recent_destinations')
      .select('address, city, latitude, longitude')
      .eq('user_id', user.id)
      .order('used_at', { ascending: false })
      .limit(MAX_ITEMS * 2);
    if (data?.length) {
      const deduped = deduplicateByAddress(data as RecentDestination[]).slice(0, MAX_ITEMS);
      return deduped;
    }
  }

  const result = await readAsync();
  const deduped = deduplicateByAddress(result).slice(0, MAX_ITEMS);
  if (deduped.length === 0 && typeof setTimeout !== 'undefined') {
    await new Promise((r) => setTimeout(r, 150));
    return deduplicateByAddress(await readAsync()).slice(0, MAX_ITEMS);
  }
  return deduped;
}

/** Adiciona um destino: grava no Supabase (se logado) e mantém AsyncStorage. Sem duplicatas (mesmo endereço normalizado). */
export async function addRecentDestination(item: RecentDestination): Promise<void> {
  const list = await getRecentDestinations();
  const newKey = normalizeKey(item.address, item.city);
  const filtered = list.filter((x) => normalizeKey(x.address, x.city) !== newKey);
  const next = [{ ...item, address: item.address.trim(), city: (item.city ?? '').trim() || item.address.trim() }, ...filtered].slice(0, MAX_ITEMS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: existingRows } = await supabase
      .from('recent_destinations')
      .select('address, city')
      .eq('user_id', user.id);
    const recentList = (existingRows ?? []) as RecentDestination[];
    const alreadyExists = recentList.some((r) => normalizeKey(r.address, r.city) === newKey);
    if (alreadyExists) return;
    await supabase.from('recent_destinations').insert({
      user_id: user.id,
      address: item.address.trim(),
      city: (item.city ?? '').trim() || item.address.trim(),
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
    });
  }
}
