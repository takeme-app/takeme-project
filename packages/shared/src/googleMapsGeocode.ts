/**
 * Geocoding via Google Geocoding API (mesma chave EXPO_PUBLIC_GOOGLE_MAPS_API_KEY dos mapas).
 * Ative "Geocoding API" no Google Cloud Console.
 */
const GEOCODE = 'https://maps.googleapis.com/maps/api/geocode/json';

export type GoogleGeocodeResult = {
  latitude: number;
  longitude: number;
  placeName: string;
  /** Cidade (locality ou, em falta, administrative_area_level_2). */
  locality: string | null;
  /** Estado por extenso (administrative_area_level_1 long_name, ex: "São Paulo"). */
  adminAreaLevel1: string | null;
  /** Sigla do estado (administrative_area_level_1 short_name, ex: "SP"). */
  adminAreaLevel1Code: string | null;
};

type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GeocodeResultItem = {
  formatted_address?: string;
  geometry?: { location?: { lat: number; lng: number } };
  address_components?: AddressComponent[];
};

type GeocodeResponse = {
  results?: GeocodeResultItem[];
  status?: string;
};

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function extractLocalityAndState(
  components: AddressComponent[] | undefined,
): { locality: string | null; adminAreaLevel1: string | null; adminAreaLevel1Code: string | null } {
  if (!components?.length) {
    return { locality: null, adminAreaLevel1: null, adminAreaLevel1Code: null };
  }
  let adminAreaLevel1: string | null = null;
  let adminAreaLevel1Code: string | null = null;
  let locality: string | null = null;
  for (const c of components) {
    const t = c.types;
    if (t.includes('administrative_area_level_1')) {
      adminAreaLevel1 = c.long_name;
      adminAreaLevel1Code = c.short_name;
    }
    if (t.includes('locality')) locality = c.long_name;
  }
  if (!locality) {
    for (const c of components) {
      if (c.types.includes('administrative_area_level_2')) {
        locality = c.long_name;
        break;
      }
    }
  }
  return { locality, adminAreaLevel1, adminAreaLevel1Code };
}

/** Resultado útil para busca por cidade (evita só "Brasil"). */
function hasCityLikeComponent(components: AddressComponent[] | undefined): boolean {
  if (!components?.length) return false;
  return components.some(
    (c) =>
      c.types.includes('locality') ||
      c.types.includes('administrative_area_level_2') ||
      c.types.includes('administrative_area_level_1'),
  );
}

function resultFromGeocodeItem(r: GeocodeResultItem): GoogleGeocodeResult | null {
  const loc = r.geometry?.location;
  if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return null;
  const { locality, adminAreaLevel1, adminAreaLevel1Code } = extractLocalityAndState(
    r.address_components,
  );
  return {
    latitude: loc.lat,
    longitude: loc.lng,
    placeName: r.formatted_address ?? '',
    locality,
    adminAreaLevel1,
    adminAreaLevel1Code,
  };
}

export type GoogleGeocodeSuggestOptions = {
  limit?: number;
  /** Prioriza municípios locais (query com ", Brasil" + filtro por componentes). */
  cityBias?: boolean;
};

export async function googleForwardGeocode(
  query: string,
  apiKey: string,
): Promise<GoogleGeocodeResult | null> {
  const q = query.trim();
  if (!q || !apiKey.trim()) return null;
  const url = `${GEOCODE}?address=${encodeURIComponent(q)}&components=country:BR&language=pt&key=${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as GeocodeResponse;
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return null;
    const r = data.results?.[0];
    if (!r) return null;
    return resultFromGeocodeItem(r);
  } catch {
    return null;
  }
}

/** Várias sugestões a partir do texto (Geocoding retorna múltiplos candidatos). */
export async function googleGeocodeSuggest(
  query: string,
  apiKey: string,
  options?: GoogleGeocodeSuggestOptions,
): Promise<GoogleGeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2 || !apiKey.trim()) return [];
  const limit = options?.limit ?? 6;
  const cityBias = options?.cityBias === true;
  const addressQuery = cityBias ? `${q}, Brasil` : q;
  const url = `${GEOCODE}?address=${encodeURIComponent(addressQuery)}&components=country:BR&language=pt&key=${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as GeocodeResponse;
    if (data.status !== 'OK' || !data.results?.length) return [];
    const out: GoogleGeocodeResult[] = [];
    for (const item of data.results) {
      if (cityBias && !hasCityLikeComponent(item.address_components)) continue;
      const g = resultFromGeocodeItem(item);
      if (g) out.push(g);
      if (out.length >= limit) break;
    }
    if (cityBias && out.length === 0) {
      for (const item of data.results) {
        const g = resultFromGeocodeItem(item);
        if (g) out.push(g);
        if (out.length >= limit) break;
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Normaliza texto para comparar cidade/estado com `public.bases`. */
export function normalizeLocationKey(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
