/**
 * Geocoding via Google Geocoding API (mesma chave EXPO_PUBLIC_GOOGLE_MAPS_API_KEY dos mapas).
 * Ative "Geocoding API" no Google Cloud Console.
 */
const GEOCODE = 'https://maps.googleapis.com/maps/api/geocode/json';

export type GoogleGeocodeResult = {
  latitude: number;
  longitude: number;
  placeName: string;
};

type GeocodeResponse = {
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  }>;
  status?: string;
};

function resultFromGeocodeItem(r: {
  formatted_address?: string;
  geometry?: { location?: { lat: number; lng: number } };
}): GoogleGeocodeResult | null {
  const loc = r.geometry?.location;
  if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return null;
  return {
    latitude: loc.lat,
    longitude: loc.lng,
    placeName: r.formatted_address ?? '',
  };
}

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
  options?: { limit?: number },
): Promise<GoogleGeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2 || !apiKey.trim()) return [];
  const limit = options?.limit ?? 6;
  const url = `${GEOCODE}?address=${encodeURIComponent(q)}&components=country:BR&language=pt&key=${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as GeocodeResponse;
    if (data.status !== 'OK' || !data.results?.length) return [];
    const out: GoogleGeocodeResult[] = [];
    for (const item of data.results) {
      const g = resultFromGeocodeItem(item);
      if (g) out.push(g);
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}
