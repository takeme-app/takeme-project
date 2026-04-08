/**
 * Geocoding forward via Mapbox Geocoding API (mesmo token dos mapas).
 * Use no cliente ao salvar destino e no motorista como fallback quando não há lat/lng no pedido.
 */
const MAPBOX_GEOCODE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

export type MapboxGeocodeResult = {
  latitude: number;
  longitude: number;
  placeName: string;
};

export async function mapboxForwardGeocode(
  query: string,
  accessToken: string,
  options?: { country?: string; limit?: number },
): Promise<MapboxGeocodeResult | null> {
  const q = query.trim();
  if (!q || !accessToken.trim()) return null;
  const limit = options?.limit ?? 1;
  const country = options?.country ?? 'br';
  const url = `${MAPBOX_GEOCODE}/${encodeURIComponent(q)}.json?access_token=${encodeURIComponent(
    accessToken,
  )}&limit=${limit}&country=${country}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ center?: [number, number]; place_name?: string }>;
    };
    const f = data.features?.[0];
    const c = f?.center;
    if (!c || c.length < 2) return null;
    const [lng, lat] = c;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      latitude: lat,
      longitude: lng,
      placeName: f.place_name ?? q,
    };
  } catch {
    return null;
  }
}

/** Sugestões para autocomplete (mesma API, modo autocomplete + vários resultados). */
export async function mapboxGeocodeSuggest(
  query: string,
  accessToken: string,
  options?: { country?: string; limit?: number; language?: string },
): Promise<MapboxGeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2 || !accessToken.trim()) return [];
  const limit = options?.limit ?? 6;
  const country = options?.country ?? 'br';
  const language = options?.language ?? 'pt';
  const url = `${MAPBOX_GEOCODE}/${encodeURIComponent(q)}.json?access_token=${encodeURIComponent(
    accessToken,
  )}&autocomplete=true&limit=${limit}&country=${country}&language=${language}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      features?: Array<{ center?: [number, number]; place_name?: string }>;
    };
    const out: MapboxGeocodeResult[] = [];
    for (const f of data.features ?? []) {
      const c = f.center;
      if (!c || c.length < 2) continue;
      const [lng, lat] = c;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      out.push({
        latitude: lat,
        longitude: lng,
        placeName: f.place_name ?? q,
      });
    }
    return out;
  } catch {
    return [];
  }
}
